const fs = require("fs");
const sysPath = require("path");
const which = require("which");
const async = require("async");
const anyspawn = require("anyspawn");
const mv = require("mv");

const bversion = "2.10.12";
const new_branch = "__umd_features__";
const has_new_branch = new RegExp(`(?:^|\\n)\\s*(?:\\*?\\s*)${ new_branch }\\s*(?:\\n|$)`, "m");

const {push} = Array.prototype;
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
    const projectBrunch = sysPath.join(projectModules, "brunch");
    const patchesFolder = sysPath.join(projectRoot, "patches");

    config.project.modules = projectModules;
    config.project.brunch = projectBrunch;
    config.patches.folder = patchesFolder;

    const cloneCmd = `git clone --depth 1 --branch ${ bversion } https://github.com/brunch/brunch.git`;

    const preinstall = [
        function() {
            const next = arguments[arguments.length - 1];
            anyspawn.spawn("npm install --production --ignore-scripts", {
                stdio: "inherit",
                cwd: projectRoot
            }, next);
        }
    ];

    const spawnBrunchOptions = {
        stdio: "inherit",
        cwd: projectBrunch
    };

    const resetRepoBrunchTasks = [
        function() {
            const next = arguments[arguments.length - 1];
            anyspawn.exec("rm -rf brunch", {
                stdio: "inherit",
                cwd: sysPath.dirname(projectBrunch)
            }, next);
        },

        function() {
            const next = arguments[arguments.length - 1];
            anyspawn.spawn(cloneCmd, {
                stdio: "inherit",
                cwd: sysPath.dirname(projectBrunch)
            }, next);
        },

        function() {
            const next = arguments[arguments.length - 1];
            anyspawn.exec("git branch -l", spawnBrunchOptions, next);
        },

        function(data, code, next) {
            let commands = [
                `git checkout tags/${ bversion }`
            ];

            if (has_new_branch.test(data)) {
                commands.push(`git branch -D "${ new_branch }"`);
            }

            commands = commands.map(cmd => {
                return [cmd, {
                    cwd: projectBrunch
                }];
            });

            anyspawn.spawnSeries(commands, next);
        }
    ];

    fs.lstat(projectBrunch, (err, stats) => {
        if (err) {
            // Brunch folder doesn't exists
            // clone repo before installing
            preinstall.push(function() {
                const next = arguments[arguments.length - 1];
                anyspawn.spawn(cloneCmd, {
                    stdio: "inherit",
                    cwd: sysPath.dirname(projectBrunch)
                }, next);
            });
            doInstall();
            return;
        }

        fs.lstat(sysPath.join(projectBrunch, ".git"), (err, stats) => {
            if (stats && stats.isDirectory()) {
                preinstall.unshift(function() {
                    const next = arguments[arguments.length - 1];
                    mv(sysPath.join(projectBrunch, ".git"), sysPath.join(projectBrunch, ".github"), next);
                });

                preinstall.push(function() {
                    const next = arguments[arguments.length - 1];
                    mv(sysPath.join(projectBrunch, ".git"), sysPath.join(projectBrunch, ".github"), next);
                });
                push.apply(preinstall, resetRepoBrunchTasks);

                doInstall();
                return;
            }

            fs.lstat(sysPath.join(projectBrunch, ".github"), (err, stats) => {
                if (stats && stats.isDirectory()) {
                    preinstall.push(function() {
                        const next = arguments[arguments.length - 1];
                        mv(sysPath.join(projectBrunch, ".git"), sysPath.join(projectBrunch, ".github"), next);
                    });
                }

                push.apply(preinstall, resetRepoBrunchTasks);
                doInstall();
            });
        });
    });

    function doInstall() {
        async.waterfall(preinstall, err => {
            if (err) {
                done(err);
                return;
            }
            install(config, err => {
                if (err) {
                    done(err);
                    return;
                }

                mv(sysPath.join(projectBrunch, ".git"), sysPath.join(projectBrunch, ".github"), done);
            });
        });
    }
}

function install(config, done) {
    const brunchPatches = [
        "brunch-2.10.x-anymatch_feature",
        "brunch-2.10.x-completer_feature",
        "brunch-2.10.x-config_compiler_feature",
        "brunch-2.10.x-init_feature",
        "brunch-2.10.x-nameCleaner_path",
        "brunch-2.10.x-onCompile_blocking"
    ];

    const filePatches = [
        ["node_modules/log4js/lib/log4js.js", "log4js-v0.6.x-shutdown_fix.patch"],
        // ["node_modules/highlight.js/lib/languages/handlebars.js", "hljs_hbs-8.7.0_fix.patch"],
        ["node_modules/stylus/lib", "stylus-0.x-include-feature.patch"]
    ];

    const projectBrunch = config.project.brunch;
    const patchesFolder = config.patches.folder;

    const tasks = [];
    let patchFile;

    push.apply(tasks, [
        [`git checkout tags/${ bversion }`, {
            cwd: projectBrunch
        }],
        [`git checkout -b "${ new_branch }"`, {
            cwd: projectBrunch
        }]
    ]);

    const _len = brunchPatches.length;
    for (let i = 0; i < _len; i++) {
        patchFile = sysPath.relative(projectBrunch, sysPath.join(patchesFolder, `${ brunchPatches[i] }.patch`));
        tasks.push([`git apply -v ${ anyspawn.quoteArg(patchFile) }`, {
            cwd: projectBrunch
        }]);
    }

    push.apply(tasks, [
        function(done) {
            const readable = fs.createReadStream(sysPath.resolve(__dirname, "..", "utils", "read-components.js"));
            const writable = fs.createWriteStream(sysPath.resolve(__dirname, "..", "node_modules", "brunch", "lib", "utils", "read-components.js"));
            readable.pipe(writable);
            writable.on("finish", done);
        },
        function(done) {
            const readable = fs.createReadStream(sysPath.resolve(__dirname, "..", "utils", "remove-comments.js"));
            const writable = fs.createWriteStream(sysPath.resolve(__dirname, "..", "node_modules", "brunch", "lib", "utils", "remove-comments.js"));
            readable.pipe(writable);
            writable.on("finish", done);
        },
        ["npm install --production", {
            cwd: projectBrunch
        }]
    ]);

    anyspawn.spawnSeries(tasks, {
        stdio: "inherit"
    }, err => {
        if (err) {
            done(err);
            return;
        }

        patchSeries(filePatches, config, done);
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
