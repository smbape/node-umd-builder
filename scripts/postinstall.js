const fs = require("fs");
const sysPath = require("path");
const which = require("which");
const anyspawn = require("anyspawn");

const emptyFn = Function.prototype;

let patch_exe = "patch";

if (process.platform === "win32") {
    try {
        patch_exe = which.sync("patch");
    } catch ( err ) {
        const git_exe = which.sync("git");
        if (git_exe.slice(-"\\cmd\\git.exe".length).toLowerCase() === "\\cmd\\git.exe") {
            patch_exe = `${ git_exe.slice(0, -"\\cmd\\git.exe".length) }\\usr\\bin\\patch.exe`;
        }
    }

    fs.accessSync(patch_exe, fs.constants.X_OK);
}

setup(sysPath.join(__dirname, ".."), err => {
    if (err) {
        console.error(err && err.stack || (new Error(err)).stack);
    }
});

function setup(projectRoot, done) {
    if ("function" !== typeof done) {
        done = emptyFn;
    }

    // https://ariejan.net/2009/10/26/how-to-create-and-apply-a-patch-with-git/
    const config = {
        patches: {},
        project: {
            root: projectRoot
        }
    };

    const projectModules = sysPath.join(projectRoot, "node_modules");
    const projectBrunch = sysPath.dirname(require.resolve("brunch/package.json"));
    const patchesFolder = sysPath.join(projectRoot, "patches");

    config.project.modules = projectModules;
    config.project.brunch = projectBrunch;
    config.patches.folder = patchesFolder;

    anyspawn.spawnSeries([
        function(next) {
            const readable = fs.createReadStream(sysPath.resolve(config.project.root, "utils", "read-components.js"));
            const writable = fs.createWriteStream(sysPath.resolve(config.project.brunch, "lib", "utils", "read-components.js"));
            writable.on("finish", next);
            writable.on("error", next);
            readable.pipe(writable);
        },
        function(next) {
            const readable = fs.createReadStream(sysPath.resolve(config.project.root, "utils", "remove-comments.js"));
            const writable = fs.createWriteStream(sysPath.resolve(config.project.brunch, "lib", "utils", "remove-comments.js"));
            writable.on("finish", next);
            writable.on("error", next);
            readable.pipe(writable);
        }
    ], {
        stdio: "inherit"
    }, err => {
        if (err) {
            done(err);
            return;
        }

        patchSeries([
            "brunch-2.10.x-anymatch_feature",
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
        ]), config, done);

    });
}

function patchSeries(patches, config, done) {
    let i = -1;
    const _len = patches.length;
    const projectRoot = config.project.root;
    const patchesFolder = config.patches.folder;

    iterate(0);

    function iterate(code) {
        let file;
        if ((code === 0 || code === 1) && ++i < _len) {
            file = sysPath.relative(projectRoot, sysPath.join(projectRoot, patches[i][0]));
            resolveModule(file, projectRoot, (err, file, stats) => {
                if (err) {
                    done(err);
                    return;
                }

                const patch = sysPath.join(patchesFolder, patches[i][1]);
                let argv, cwd;

                if (stats.isDirectory()) {
                    argv = ["-N", "-i", patch, "-p1"];
                    cwd = file;
                } else {
                    argv = ["-N", "-i", sysPath.relative(projectRoot, patch), file];
                    cwd = projectRoot;
                }

                anyspawn.spawn(patch_exe, argv, {
                    cwd,
                    stdio: "inherit",
                    prompt: true
                }, iterate);
            });
        } else {
            if (code === 2) {
                code = `Cannot find file to patch ${ patches[i][0] }`;
            } else if (code === 1) {
                code = 0;
            }
            done(code);
        }
    }
}

function resolveModule(file, root, done) {
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
}
