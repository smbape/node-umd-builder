'use strict';

require('coffee-script').register();

var fs = require('fs'),
    sysPath = require('path'),
    _explore = require('fs-explorer')._explore,
    mkdirp = require('mkdirp'),
    log4js = require('umd-builder/log4js'),
    logger = log4js.getLogger('umd-builder');

var cli = require('brunch/src/cli');

var program = require('brunch/node_modules/commander');
program.commands.filter(function(command) {
    if (command._name === 'build' || command._name === 'watch') {
        command.option('--clean', 'remove public directory before starting');
        return true;
    }
    return false;
});

var command = process.argv[2];

if ((command === 'build' || command === 'watch') && ~(process.argv.indexOf('--clean'))) {
    clean(run);
} else {
    run();
}

function clean(next) {
    // todo, take plublic path from config
    var PUBLIC_PATH = sysPath.resolve('public');

    logger.warn('Cleaning', PUBLIC_PATH);
    remove(PUBLIC_PATH, {
        empty: true
    }, function(err) {
        logger.warn('Cleaning done');
        if (err && err.code !== 'ENOENT') {
            logger.error(err);
        }
        next();
    });
}

function run() {
    cli.run();
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