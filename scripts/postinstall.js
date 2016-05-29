// jshint node: true
'use strict';

var fs = require('fs'),
    sysPath = require('path'),
    os = require('os'),
    chalk = require('chalk'),
    which = require('which'),
    anyspawn = require('anyspawn'),
    new_branch = '__umd_features__',
    username = require('username').sync(),
    push = Array.prototype.push,
    slice = Array.prototype.slice;

require('fs').readdir('../lib', function(err) {
    if (err) {
        anyspawn.spawn('npm run prepublish', {
            stdio: 'inherit'
        }, function(err) {
            if (err) throw err;
            setup(sysPath.join(__dirname, '..'));
        });
    }
});

function setup(projectRoot, done) {
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
        is_new_branch = new RegExp('\\*\\s+' + new_branch + '(?:\\n|$)'),
        has_new_branch = new RegExp('(?:^|\n)' + new_branch + '(?:\\n|$)');

    // make such patch executable exists
    which.sync('patch');

    var tasks = [
            // with node v4 and npm 3.4.0 and npm 3.4.1, nested postinstall script is launched before end of all packages installation
            ['npm install --production --ignore-scripts', {
                cwd: projectRoot
            }]
        ],
        options = {
            stdio: 'inherit',
            cwd: projectBrunch
        };
    if (fs.existsSync(projectBrunch)) {
        anyspawn.spawn('git rev-parse', options, function(code) {
            if (code) {
                throw new Error('"' + projectBrunch + '" exists and is not a git repository');
            }

            anyspawn.exec('git branch -l', options, function(err, data) {
                if (err) {
                    throw new Error('"' + projectBrunch + '": cannot list branches');
                }
                var commands;
                if (is_new_branch.test(data)) {
                    commands = [
                        'git reset --hard HEAD~2',
                        'git checkout master',
                        'git branch -D "' + new_branch + '"'
                    ];
                } else if (has_new_branch.test(data)) {
                    commands = [
                        'git reset --hard HEAD',
                        'git checkout master',
                        'git branch -D "' + new_branch + '"'
                    ];
                } else {
                    commands = [
                        'git reset --hard HEAD',
                        'git checkout master'
                    ];
                }

                commands = commands.map(function(element) {
                    return [element, {
                        cwd: projectBrunch
                    }];
                });

                anyspawn.spawnSeries(commands, function(err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    install(tasks, config, done);
                });
            });
        });
    } else {
        tasks.push(['git clone https://github.com/brunch/brunch.git', {
            cwd: sysPath.dirname(projectBrunch)
        }]);
        install(tasks, config, done);
    }
}

function install(tasks, config, done) {
    if ('function' !== typeof done) {
        done = emptyFn;
    }

    var brunchPatches = [
            'brunch-2.8.x-anymatch_feature',
            'brunch-2.8.x-completer_feature',
            'brunch-2.8.x-config_compiler_feature',
            'brunch-2.8.x-init_feature',
            'brunch-2.8.x-fix_ready_event_emitted_before_read_done'
        ],
        filePatches = [
            ['node_modules/log4js/lib/log4js.js', 'log4js-v0.6.x-shutdown_fix.patch'],
            ['node_modules/highlight.js/lib/languages/handlebars.js', 'hljs_hbs-8.7.0_fix.patch'],
            ['node_modules/requirejs/bin/r.js', 'rjs-2.1.22.patch']
        ],
        projectBrunch = config.project.brunch,
        projectRoot = config.project.root,
        patchesFolder = config.patches.folder,
        patchFile;

    push.apply(tasks, [
        ['git checkout tags/2.8.0', {
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

    function iterate(err) {
        var file, patch;
        if (err === 0 && ++i < _len) {
            file = sysPath.relative(projectRoot, sysPath.join(projectRoot, patches[i][0]));
            locateModuleFile(file, projectRoot, function(err, file) {
                if (err) {
                    return done(err);
                }
                patch = sysPath.relative(projectRoot, sysPath.join(patchesFolder, patches[i][1]));
                anyspawn.spawn('patch ' + anyspawn.quoteArg(file) + ' < ' + anyspawn.quoteArg(patch), {
                    cwd: projectRoot,
                    stdio: 'inherit'
                }, iterate);
            });
        } else {
            done(err);
        }
    }
}

function locateModuleFile(file, root, cb) {
    var filepath = sysPath.join(root, file),
        newRoot;
    fs.exists(filepath, function(exists) {
        if (exists) {
            cb(null, filepath);
        } else if ((newRoot = sysPath.dirname(root)) !== root) {
            locateModuleFile(file, newRoot, cb);
        } else {
            cb(new Error('Unable to find file'));
        }
    });
}

function emptyFn() {}