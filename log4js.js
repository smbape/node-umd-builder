'use strict';

var mkdirp = require('mkdirp'),
    sysPath = require('path');

var configFile, log4js, logFolder, reloadSecs;

if (!global.log4js) {
    log4js = global.log4js || (global.log4js = require('log4js'));
    configFile = sysPath.join(__dirname, 'log4js.json');
    if (process.argv[2] === 'watch') {
        reloadSecs = 60;
    } else {
        reloadSecs = null;
    }

    log4js.configure(configFile, {
        reloadSecs: reloadSecs,
        cwd: process.cwd()
    });
}

module.exports = global.log4js;