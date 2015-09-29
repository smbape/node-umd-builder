// jshint node: true
'use strict';

var fs = require('fs'),
    sysPath = require('path'),
    os = require('os'),
    chalk = require('chalk'),
    which = require('which'),
    anyspawn = require('anyspawn'),
    new_branch = '__umd_features__';

fs.readdir('lib', function(err) {
    anyspawn.spawn('npm run prepublish', function() {
        setup(sysPath.join(__dirname, '..'));
    });
});

function setup(projectRoot, done) {
    // https://ariejan.net/2009/10/26/how-to-create-and-apply-a-patch-with-git/

    var projectModules = sysPath.join(projectRoot, 'node_modules'),
        projectBrunch = sysPath.join(projectModules, 'brunch'),
        projectLodash = sysPath.join(projectModules, 'lodash'),
        username = require('username').sync(),
        is_new_branch = new RegExp('\\*\\s+' + new_branch + '(?:\\n|$)'),
        has_new_branch = new RegExp('(?:^|\n)' + new_branch + '(?:\\n|$)'),
        patchesFolder = sysPath.join(__dirname, '..', 'patches'),
        push = Array.prototype.push,
        slice = Array.prototype.slice;

    // make such patch executable exists
    which.sync('patch');

    var tasks = [],
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
                    install(tasks, done);
                });
            });
        });
    } else {
        tasks.push(['git clone https://github.com/brunch/brunch.git', {
            cwd: projectModules
        }]);
        install(tasks, done);
    }

    function install(tasks, done) {
        if ('function' !== typeof done) {
            done = emptyFn;
        }

        var brunchPatches = [
                'brunch-1.8.x-anymatch_feature',
                'brunch-1.8.x-completer_feature',
                'brunch-1.8.x-config_compiler_feature'
            ],
            filePatches = [
                ['node_modules/log4js/lib/log4js.js', 'log4js-v0.6.x-shutdown_fix.patch'],
                ['node_modules/highlight.js/lib/languages/handlebars.js', 'hljs_hbs-8.7.0_fix.patch']
            ],
            patchFile;

        push.apply(tasks, [
            ['git checkout tags/1.8.5', {
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
            }], ['git apply ' + anyspawn.quoteArg(patchFile), {
                cwd: projectBrunch
            }]);
        }

        push.apply(tasks, [
            ['npm install', {
                cwd: projectLodash
            }],
            ['npm install', {
                cwd: projectBrunch
            }],
            ['npm install --ignore-scripts', {
                cwd: projectRoot
            }]
        ]);

        anyspawn.spawnSeries(tasks, {
            stdio: 'inherit'
        }, function(err) {
            if (err) {
                done(err);
                return;
            }

            patchSeries(filePatches, done);
        });
    }

    function patchSeries(patches, done) {
        var i = -1,
            _len = patches.length;

        iterate(0);

        function iterate(err) {
            var file, patch;
            if (err === 0 && ++i < _len) {
                file = sysPath.relative(projectRoot, sysPath.join(projectRoot, patches[i][0]));
                patch = sysPath.relative(projectRoot, sysPath.join(patchesFolder, patches[i][1]));
                anyspawn.spawn('patch ' + anyspawn.quoteArg(file) + ' < ' + anyspawn.quoteArg(patch), {
                    cwd: projectRoot,
                    stdio: 'inherit'
                }, iterate);
            } else {
                done(err);
            }
        }
    }

    function emptyFn() {}
}