'use strict';

var fs = require('fs'),
    sysPath = require('path'),
    _explore = require('fs-explorer')._explore,
    mkdirp = require('mkdirp'),
    quoteArg = require('anyspawn').quoteArg,
    log4js = require('./log4js'),
    logger = log4js.getLogger('umd-builder');

var cli = require('brunch/lib/cli'),
    program = require('brunch/node_modules/commander');

program.commands.forEach(function(command) {
    if (command._name === 'build' || command._name === 'watch') {
        command.option('-c, --clean', 'empty public directory before starting');
        command.option('-f, --force', 'force clean without prompt');
    }
});

var command = process.argv[2],
    cleanOpt, forceOpt;
if (/^w|watch|b|build|bb|bbp|bw|bws$/.test(command)) {
    process.argv.slice(2).forEach(function(arg) {
        if (arg === '--clean' || (/^-\w/.test(arg) && ~arg.indexOf('c'))) {
            cleanOpt = true;
        }
        if (arg === '--force' || (/^-\w/.test(arg) && ~arg.indexOf('f'))) {
            forceOpt = true;
        }
    });
}

if (cleanOpt) {
    clean(run);
} else {
    run();
}

function run() {
    cli.run();
}

function clean(next) {
    // TODO: take plublic path from config
    var PUBLIC_PATH = sysPath.resolve('public');

    var prompt = require('prompt');
    if (forceOpt) {
        prompt.override = {
            answer: 'yes'
        };
    }
    prompt.colors = false;
    prompt.message = '';
    prompt.delimiter = '';
    prompt.start();

    prompt.get({
        properties: {
            answer: {
                description: 'Confirm cleaning of ' + quoteArg(PUBLIC_PATH) + '? [yes/no]: '
            }
        }
    }, function(err, result) {
        if (result && /^yes$/i.test(result.answer)) {
            logger.warn('cleaning folder ' + quoteArg(PUBLIC_PATH));

            remove(PUBLIC_PATH, {
                empty: true
            }, function(err) {
                logger.warn('cleaned ' + quoteArg(PUBLIC_PATH));
                if (err && err.code !== 'ENOENT') {
                    logger.error(err);
                }
                next();
            });
        } else {
            next();
        }
    });
}

/**
 * rm -rf. Symlink are not resolved by default, avoiding unwanted deep deletion
 * there should be a way to do it with rimraf, but too much options digging to find a way to do it
 * @param  {String}   file or folder to remove
 * @param  {Function} done called on end
 */
function remove(file, options, done) {
    if (arguments.length === 2 && 'function' === typeof options) {
        done = options;
        options = {};
    }

    if ('function' !== typeof done) {
        done = function() {};
    }

    function callfile(file, stats, done) {
        fs.unlink(file, done);
    }

    function calldir(dir, stats, files, state, done) {
        if (state === 'end') {
            if (options.empty && dir === file) {
                done();
            } else {
                if (stats.isSymbolicLink()) {
                    fs.unlink(dir, done);
                } else {
                    fs.rmdir(dir, function(er) {
                        if (er && (er.code === 'ENOTEMPTY' || er.code === 'EEXIST' || er.code === 'EPERM')) {
                            // try in few time, last deletion is not completely ended
                            setTimeout(function() {
                                fs.rmdir(dir, done);
                            }, 10);
                        } else {
                            done(er);
                        }
                    });
                }
            }
        } else {
            done();
        }
    }

    _explore(file, callfile, calldir, options, done);
}