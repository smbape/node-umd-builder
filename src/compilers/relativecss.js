'use strict';

module.exports = RelativeCSS;

var log4js = global.log4js || (global.log4js = require('log4js')),
    logger = log4js.getLogger('relative-css'),
    sysPath = require('path'),
    rework = require('rework'),
    reworkUrl = require('rework-plugin-url'),
    validator = require('validator'),
    util = require('util'),
    builder = require('../builder'),
    writeData = require('../writeData');

function RelativeCSS(config) {
    if (config == null) {
        config = {};
    }
    this.sourceMap = !!config.sourceMaps;
    this.amdDestination = config.modules.amdDestination;
    this.root = config.paths.root;
    this.joinTo = config.files.stylesheets.joinTo;
}

RelativeCSS.brunchPluginName = 'relative-css-brunch';
RelativeCSS.prototype.brunchPlugin = true;
RelativeCSS.prototype.type = 'stylesheet';
RelativeCSS.prototype.completer = true;

RelativeCSS.prototype.compile = function(params, callback) {
    var data = params.data,
        path = params.path,
        map = params.map,
        destination = sysPath.join(this.root, this.amdDestination(path, true)),
        source = sysPath.relative(sysPath.dirname(this.target), destination).replace(/[\\]/g, '/'),
        root = this.root,
        sourceMap = map || this.sourceMap,
        target, matcher;

    for (var file in this.joinTo) {
        matcher = this.joinTo[file];
        if (matcher.test(path)) {
            target = file;
            break;
        }
    }

    if (!target) {
        return callback(null, params);
    }

    this.paths = this.paths || builder.getConfig().paths;
    writeData(data, sysPath.join(this.paths.PUBLIC_PATH, this.amdDestination(path) + '.css'), function(err) {
        if (err) {
            return callback(err, params);
        }

        try {
            data = rebaseUrls(data, {
                currentDir: sysPath.dirname(destination),
                root: sysPath.dirname(sysPath.join(root, target))
            });
        } catch (error) {
            logger.warn('error while relative-css', path, error.message);
        }

        callback(null, {
            path: path,
            map: map,
            data: data
        });
    });
};


function isAbsolute(url) {
    var normal = sysPath.normalize(url);
    var absolute = sysPath.resolve(url);
    if (process.platform === 'win32') {
        absolute = absolute.substr(2);
    }
    return normal === absolute;
}

function isUrl(url) {
    if (!url) {
        return false;
    }

    // protocol relative URLs
    if (url.indexOf('//') === 0 && validator.isURL(url, {
            allow_protocol_relative_urls: true
        })) {
        return true;
    }

    return validator.isURL(url, {
        require_protocol: true
    });
}

function rebaseUrls(css, options) {
    return rework(css)
        .use(reworkUrl(function(url) {
            if (isAbsolute(url) || isUrl(url) || /^data:.*;.*,/.test(url)) {
                return url;
            }

            var absolutePath = sysPath.join(options.currentDir, url);
            var p = sysPath.relative(options.root, absolutePath);

            if (process.platform === 'win32') {
                p = p.replace(/\\/g, '/');
            }

            return p;
        })).toString();
}