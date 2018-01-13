"use strict";

module.exports = RebaseCssUrl;

const log4js = global.log4js || (global.log4js = require("log4js"));
const logger = log4js.getLogger("rebase-css-url");
const sysPath = require("path");
const rework = require("rework");
const reworkUrl = require("rework-plugin-url");
const validator = require("validator");
// let util = require('util');
const builder = require("../builder");
const writeData = require("../writeData");

function RebaseCssUrl(config) {
    if (config == null) {
        config = {};
    }
    this.sourceMap = Boolean(config.sourceMaps);
    this.amdDestination = config.modules.amdDestination;
    this.root = config.paths.root;
    this.joinTo = config.files.stylesheets.joinTo;
    this.paths = builder.generateConfig(config).paths;
}

RebaseCssUrl.brunchPluginName = "rebase-css-url-brunch";
RebaseCssUrl.prototype.brunchPlugin = true;
RebaseCssUrl.prototype.type = "stylesheet";
RebaseCssUrl.prototype.completer = true;

RebaseCssUrl.prototype.compile = function(params, callback) {
    let data = params.data;
    const path = params.path;
    const map = params.map;
    const dstFilename = this.amdDestination(path);
    // let sourceMap = map || this.sourceMap;
    let target, matcher;

    // eslint-disable-next-line guard-for-in
    for (const file in this.joinTo) {
        matcher = this.joinTo[file];
        if (matcher.test(path)) {
            target = file;
            break;
        }
    }

    if (!target) {
        callback(null, params);
        return;
    }

    writeData(data, sysPath.join(this.paths.PUBLIC_PATH, dstFilename + ".css"), function(err) {
        if (err) {
            callback(err, params);
            return;
        }

        try {
            data = rebaseUrls(data, {
                currentDir: sysPath.dirname(dstFilename),
                root: sysPath.dirname(target)
            });
        } catch (error) {
            logger.warn("error while rebase-css-url", path, error.message);
        }

        callback(null, {
            path: path,
            map: map,
            data: data
        });
    });
};


function isUrl(url) {
    if (!url) {
        return false;
    }

    // protocol relative URLs
    if (url.indexOf("//") === 0 && validator.isURL(url, {
            allow_protocol_relative_urls: true
        })) {
        return true;
    }

    return validator.isURL(url, {
        require_protocol: true
    });
}

function rebaseUrls(css, options) {
    return rework(css).
        use(reworkUrl(function(url) {
            if (sysPath.isAbsolute(url) || isUrl(url) || /^data:.*;.*,/.test(url)) {
                return url;
            }

            const absolutePath = sysPath.join(options.currentDir, url);
            let p = sysPath.relative(options.root, absolutePath);

            if (process.platform === "win32") {
                p = p.replace(/\\/g, "/");
            }

            return p;
        })).toString();
}