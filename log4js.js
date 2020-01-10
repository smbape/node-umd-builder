require("coffeescript").register();

const sysPath = require("path");

let config;

if (!global.log4js) {
    global.log4js = require("log4js");
    try {
        config = require(sysPath.join(process.cwd(), "build-log4js"));
    } catch ( err ) {
        config = {
            appenders: {
                console: {
                    type: "console",
                    layout: {
                        type: "colored"
                    }
                }
            },
            categories: {
                default: {
                    appenders: ["console"],
                    level: "INFO"
                }
            }
        };
    }

    global.log4js.configure(config);
}

module.exports = global.log4js;
