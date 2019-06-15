const fs = require("fs");
const sysPath = require("path");
const which = require("which");
const anyspawn = require("anyspawn");
const eachOfLimit = require("async/eachOfLimit");
const series = require("async/series");
const semver = require("semver");

const Module = module.constructor;

const emptyFn = Function.prototype;

const chainedRequireResolve = function(module) {
    const len = arguments.length - 1;
    const args = new Array(len);
    for (let i = 0; i < len; i++) {
        args[len - 1 - i] = arguments[i + 1];
    }

    let parent = module;
    let filename;

    while (args.length !== 0) {
        filename = Module._resolveFilename(args.pop(), parent, false);

        parent = new Module(filename, module);
        parent.filename = filename;
        parent.paths = Module._nodeModulePaths(sysPath.dirname(filename));
    }

    return filename;
};

const resolveModule = (file, root, done) => {
    const filepath = sysPath.join(root, file);

    fs.lstat(filepath, (err, stats) => {
        let newRoot;

        if (!err) {
            if (stats.isSymbolicLink()) {
                fs.realpath(filepath, (err, resolvedPath) => {
                    if (err) {
                        done(err);
                        return;
                    }

                    fs.stats(resolvedPath, (err, stats) => {
                        done(err, resolvedPath, stats);
                    });
                });
                return;
            }

            done(null, filepath, stats);
        } else if ((newRoot = sysPath.dirname(root)) !== root) {
            resolveModule(file, newRoot, done);
        } else {
            done(new Error("Unable to find file"));
        }
    });
};

const setup = (projectRoot, patch_exe, done) => {
    if ("function" !== typeof done) {
        done = emptyFn;
    }

    const projectBrunch = sysPath.dirname(require.resolve("brunch/package.json"));
    const patchesFolder = sysPath.join(projectRoot, "patches");

    series([
        next => {
            const readable = fs.createReadStream(sysPath.resolve(projectRoot, "utils", "read-components.js"));
            const writable = fs.createWriteStream(sysPath.resolve(projectBrunch, "lib", "utils", "read-components.js"));
            writable.on("finish", next);
            writable.on("error", next);
            readable.pipe(writable);
        },

        next => {
            const readable = fs.createReadStream(sysPath.resolve(projectRoot, "utils", "remove-comments.js"));
            const writable = fs.createWriteStream(sysPath.resolve(projectBrunch, "lib", "utils", "remove-comments.js"));
            writable.on("finish", next);
            writable.on("error", next);
            readable.pipe(writable);
        },

        next => {
            const nativeNotifierPackage = chainedRequireResolve(module, "native-notifier/package.json");
            const nativeNotifierRoot = sysPath.dirname(nativeNotifierPackage);
            const patchVersion = semver.satisfies(require(nativeNotifierPackage).version, "<0.1.3") ? "0.1.0" : "0.1.3";
            const patch = sysPath.resolve(__dirname, `../patches/native-notifier-v${ patchVersion }-fix-windows-10-notification.patch`);
            anyspawn.exec(patch_exe, ["-N", "-p1", "-i", sysPath.relative(nativeNotifierRoot, patch)], {
                cwd: nativeNotifierRoot,
                stdio: "inherit",
                prompt: true
            }, next);
        },

        next => {
            eachOfLimit([
                "brunch-2.10.x-anymatch_feature",
                "brunch-2.10.x-check-copy-written",
                "brunch-2.10.x-completer_feature",
                "brunch-2.10.x-config_compiler_feature",
                "brunch-2.10.x-init_feature",
                "brunch-2.10.x-nameCleaner_path",
                "brunch-2.10.x-onCompile_blocking",
                "brunch-2.10.x-remove_debug_switch_from_fork",
                "brunch-2.10.x-teardown_on_build",
                "brunch-2.10.x-fix_plugins_on_off",
            ].map(patch => {
                return ["node_modules/brunch", patch + ".patch"];
            }).concat([
                // ["node_modules/highlight.js/lib/languages/handlebars.js", "hljs_hbs-8.7.0_fix.patch"],
                ["node_modules/stylus/lib", "stylus-0.x-include-feature.patch"]
            ]), 1, ([file, patch], i, next) => {
                file = sysPath.relative(projectRoot, sysPath.join(projectRoot, file));
                resolveModule(file, projectRoot, (err, file, stats) => {
                    if (err) {
                        done(err);
                        return;
                    }

                    patch = sysPath.join(patchesFolder, patch);

                    let argv, cwd;
                    if (stats.isDirectory()) {
                        argv = ["-N", "-i", patch, "-p1"];
                        cwd = file;
                    } else {
                        argv = ["-N", "-i", sysPath.relative(projectRoot, patch), file];
                        cwd = projectRoot;
                    }

                    anyspawn.exec(patch_exe, argv, {
                        cwd,
                        stdio: "inherit",
                        prompt: true
                    }, next);
                });
            }, next);
        }
    ], done);
};

let patch_exe = "patch";

if (process.platform === "win32") {
    try {
        patch_exe = which.sync("patch");
    } catch ( err ) {
        const git_exe = which.sync("git");
        if (git_exe.toLowerCase().endsWith("\\cmd\\git.exe")) {
            patch_exe = `${ git_exe.slice(0, -"\\cmd\\git.exe".length) }\\usr\\bin\\patch.exe`;
        }
    }

    fs.accessSync(patch_exe, fs.constants.X_OK);
}

setup(sysPath.join(__dirname, ".."), patch_exe, err => {
    if (err) {
        console.error(err && err.stack || (new Error(err)).stack);
    }
});
