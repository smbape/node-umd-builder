'use strict';

var mkdirp = require('mkdirp'),
    sysPath = require('path');

var log4js, logFolder, reloadSecs, config;

if (!global.log4js) {
    log4js = global.log4js = require('log4js');
    try {
        config = require(sysPath.join(process.cwd(), 'build-log4js'));
    } catch (err) {
        config = {
            "appenders": [
                {
                    "type": "console",
                    "layout": {
                        "type": "colored"
                    }
                }, {
                    "type": sysPath.join(__dirname, 'lib/appenders/file'),
                    "filename": sysPath.join(process.cwd(), 'build.log'),
                    "maxLogSize": 1048576,
                    "backups": 10
                }
            ],
            "levels": {
                "[all]": "INFO"
            }
        };
    }

    log4js.configure(config);
}

module.exports = global.log4js;