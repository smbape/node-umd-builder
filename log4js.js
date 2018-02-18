'use strict';

require('coffeescript').register();

var mkdirp = require('mkdirp'),
    sysPath = require('path');

var log4js, config;

if (!global.log4js) {
    log4js = global.log4js = require('log4js');
    try {
        config = require(sysPath.join(process.cwd(), 'build-log4js'));
    } catch ( err ) {
        config = {
            "appenders": {
                "console": {
                    "type": "console",
                    "layout": {
                        "type": "colored"
                    }
                }
            },
            "categories": {
                "default": {
                    "appenders": ["console"],
                    "level": "INFO"
                }
            }
        };
    }

    log4js.configure(config);
}

module.exports = global.log4js;