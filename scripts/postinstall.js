// jshint node: true
'use strict';

var fs = require('fs'),
    sysPath = require('path'),
    os = require('os'),
    chalk = require('chalk'),
    which = require('which'),
    async = require('async'),
    anyspawn = require('anyspawn'),
    bversion = '2.10.5',
    new_branch = '__umd_features__',
    has_new_branch = new RegExp('(?:^|\\n)\\s*(?:\\*?\\s*)' + new_branch + '\\s*(?:\\n|$)', 'm'),
    push = Array.prototype.push,
    slice = Array.prototype.slice,
    emptyFn = Function.prototype;

setup(sysPath.join(__dirname, '..'), function(err) {
    if (err) {
        console.error(err && err.stack || (new Error(err)).stack);
    }
});

function setup(projectRoot, done) {
    if ('function' !== typeof done) {
        done = emptyFn;
    }

    // https://ariejan.net/2009/10/26/how-to-create-and-apply-a-patch-with-git/
    var config = {
            patches: {},
            project: {
                root: projectRoot
            }
        },
        projectModules = config.project.modules = sysPath.join(projectRoot, 'node_modules'),
        projectBrunch = config.project.brunch = sysPath.join(projectModules, 'brunch'),
        patchesFolder = config.patches.folder = sysPath.join(projectRoot, 'patches'),
        cloneCmd = 'git clone --depth 1 --branch ' + bversion + ' https://github.com/brunch/brunch.git';

    // make sure patch executable exists
    which.sync('patch');

    var preinstall = [
        function() {
            var next = arguments[arguments.length - 1];
            anyspawn.spawn('npm install --production --ignore-scripts', {
                stdio: 'inherit',
                cwd: projectRoot
            }, next);
        }
    ];

    var spawnBrunchOptions = {
        stdio: 'inherit',
        cwd: projectBrunch
    };

    var resetRepoBrunchTasks = [
        function() {
            var next = arguments[arguments.length - 1];
            anyspawn.spawn('git rev-parse', spawnBrunchOptions, function(code) {
                if (code) {
                    // invalid git repo
                    anyspawn.spawn('rm -rf brunch', {
                        stdio: 'inherit',
                        cwd: sysPath.dirname(projectBrunch)
                    }, function(code) {
                        if (code) {
                            return next(code);
                        }
                        anyspawn.spawn(cloneCmd, {
                            stdio: 'inherit',
                            cwd: sysPath.dirname(projectBrunch)
                        }, next);
                    });
                    return;
                }

                next();
            });
        },

        function() {
            var next = arguments[arguments.length - 1];
            anyspawn.exec('git branch -l', spawnBrunchOptions, next);
        },

        function(data, code, next) {
            var commands = [
                'git reset --hard HEAD',
                'git checkout tags/' + bversion
            ];

            if (has_new_branch.test(data)) {
                commands.push('git branch -D "' + new_branch + '"');
            }

            commands = commands.map(function(cmd) {
                return [cmd, {
                    cwd: projectBrunch
                }];
            });

            anyspawn.spawnSeries(commands, next);
        }
    ];

    fs.lstat(projectBrunch, function(err, stats) {
        if (err) {
            // Brunch folder doesn't exists
            // clone repo before installing
            preinstall.push(function() {
                var next = arguments[arguments.length - 1];
                anyspawn.spawn(cloneCmd, {
                    stdio: 'inherit',
                    cwd: sysPath.dirname(projectBrunch)
                }, next);
            });
            doInstall();
            return;
        }

        fs.lstat(sysPath.join(projectBrunch, '.git'), function(err, stats) {
            if (stats && stats.isDirectory()) {
                preinstall.unshift(function() {
                    var next = arguments[arguments.length - 1];
                    anyspawn.spawn('mv .git/ .git.bak/', spawnBrunchOptions, next);
                });

                preinstall.push(function() {
                    var next = arguments[arguments.length - 1];
                    anyspawn.spawn('mv .git.bak/ .git/', spawnBrunchOptions, next);
                });
                push.apply(preinstall, resetRepoBrunchTasks);

                doInstall();
                return;
            }

            fs.lstat(sysPath.join(projectBrunch, '.git.bak'), function(err, stats) {
                if (stats && stats.isDirectory()) {

                    preinstall.push(function() {
                        var next = arguments[arguments.length - 1];
                        anyspawn.spawn('mv .git.bak/ .git/', spawnBrunchOptions, next);
                    });
                }

                push.apply(preinstall, resetRepoBrunchTasks);
                doInstall();
            });
        });

    });

    function doInstall() {
        async.waterfall(preinstall, function(err) {
            if (err) {
                return done(err);
            }
            install(config, function(err) {
                if (err) {
                    return done(err);
                }

                anyspawn.spawn('mv .git/ .git.bak/', {
                    cwd: projectBrunch
                }, done);
            });
        });
    }

}

function install(config, done) {
    var tasks = [],
        brunchPatches = [
            'brunch-2.10.x-anymatch_feature',
            'brunch-2.10.x-completer_feature',
            'brunch-2.10.x-config_compiler_feature',
            'brunch-2.10.x-init_feature',
            'brunch-2.10.x-nameCleaner_path',
            'brunch-2.10.x-onCompile_blocking'
        ],
        filePatches = [
            ['node_modules/log4js/lib/log4js.js', 'log4js-v0.6.x-shutdown_fix.patch'],
            ['node_modules/highlight.js/lib/languages/handlebars.js', 'hljs_hbs-8.7.0_fix.patch'],
            ['node_modules/stylus/lib', 'stylus-0.x-include-feature.patch']
        ],
        projectBrunch = config.project.brunch,
        projectRoot = config.project.root,
        patchesFolder = config.patches.folder,
        patchFile;

    push.apply(tasks, [
        ['git checkout tags/' + bversion, {
            cwd: projectBrunch
        }],
        ['git checkout -b "' + new_branch + '"', {
            cwd: projectBrunch
        }]
    ]);

    for (var i = 0, _len = brunchPatches.length; i < _len; i++) {
        patchFile = sysPath.relative(projectBrunch, sysPath.join(patchesFolder, brunchPatches[i] + '.patch'));
        tasks.push(['git apply -v --check ' + anyspawn.quoteArg(patchFile), {
            cwd: projectBrunch
        }], ['git apply -v ' + anyspawn.quoteArg(patchFile), {
            cwd: projectBrunch
        }]);
    }

    push.apply(tasks, [
        function(done) {
            var readable = fs.createReadStream(sysPath.resolve(__dirname, '..', 'utils', 'read-components.js')),
                writable = fs.createWriteStream(sysPath.resolve(__dirname, '..', 'node_modules', 'brunch', 'lib', 'utils', 'read-components.js'));
            readable.pipe(writable);
            writable.on('finish', done);
        },
        function(done) {
            var readable = fs.createReadStream(sysPath.resolve(__dirname, '..', 'utils', 'remove-comments.js')),
                writable = fs.createWriteStream(sysPath.resolve(__dirname, '..', 'node_modules', 'brunch', 'lib', 'utils', 'remove-comments.js'));
            readable.pipe(writable);
            writable.on('finish', done);
        },
        ['npm install --production', {
            cwd: projectBrunch
        }]
    ]);

    anyspawn.spawnSeries(tasks, {
        stdio: 'inherit'
    }, function(err) {
        if (err) {
            done(err);
            return;
        }

        patchSeries(filePatches, config, done);
    });
}

function patchSeries(patches, config, done) {
    var i = -1,
        _len = patches.length,
        projectRoot = config.project.root,
        patchesFolder = config.patches.folder;

    iterate(0);

    function iterate(code) {
        var file;
        if ( (code === 0 || code === 1) && ++i < _len ) {
            file = sysPath.relative(projectRoot, sysPath.join(projectRoot, patches[i][0]));
            resolveModule(file, projectRoot, function(err, file, stats) {
                var patch, cmd, cwd;
                if (err) {
                    return done(err);
                }

                patch = sysPath.join(patchesFolder, patches[i][1]);
                if (stats.isDirectory()) {
                    cmd = 'patch -p1 -N < ' + anyspawn.quoteArg(patch);
                    cwd = file;
                } else {
                    patch = sysPath.relative(projectRoot, patch);
                    cmd = 'patch -N ' + anyspawn.quoteArg(file) + ' < ' + anyspawn.quoteArg(patch);
                    cwd = projectRoot;
                }
                anyspawn.spawn(cmd, {
                    cwd: cwd,
                    stdio: 'inherit',
                    prompt: true
                }, iterate);
            });
        } else {
            if (code === 2) {
                code = "Cannot find file to patch " + patches[i][0];
            } else if (code === 1) {
                code = 0;
            }
            done(code);
        }
    }
}

function resolveModule(file, root, done) {
    var filepath = sysPath.join(root, file),
        newRoot;
    fs.lstat(filepath, function(err, stats) {
        if (!err) {
            if (stats.isSymbolicLink()) {
                fs.realpath(filepath, function(err, resolvedPath) {
                    if (err) {
                        return done(err);
                    }

                    fs.stats(resolvedPath, function(err, stats) {
                        done(err, resolvedPath, stats);
                    });
                });
                return;
            }

            done(null, filepath, stats);
        } else if ((newRoot = sysPath.dirname(root)) !== root) {
            resolveModule(file, newRoot, done);
        } else {
            done(new Error('Unable to find file'));
        }
    });
}