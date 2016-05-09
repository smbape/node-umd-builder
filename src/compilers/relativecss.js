'use strict';

var log4js = global.log4js || (global.log4js = require('log4js')),
    logger = log4js.getLogger('relative-css'),
    CleanCSS = require('clean-css'),
    sysPath = require('path'),
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

        var minified, result, options;

        options = {
            target: sysPath.join(root, target).replace(/[\/\\]/g, sysPath.sep),
            relativeTo: sysPath.dirname(destination),
            sourceMap: sourceMap
        };

        try {
            // TODO : fix source map
            // if (map) {
            //     logger.info('map', destination);
            // }
            // minified = {
            //     destination: {
            //         source: source,
            //         styles: data,
            //         sourceMap: map,
            //         rebase: false
            //     }
            // };
            // minified = new CleanCSS(options).minify(minified);

            minified = new CleanCSS(options).minify(data);
        } catch (err) {
            return callback(err, params);
        }

        if (minified.errors.length > 0) {
            err = minified.errors;
        } else {
            // if (minified.sourceMap) {
            //     map = minified.sourceMap.toJSON();
            //     map.sources = map.sources.map(function(element, index, array) {
            //         return element === '$stdin' ? source : element;
            //     });
            // }
            result = {
                data: minified.styles,
                map: map
            };
        }

        return callback(err, result || params);
    });
};

module.exports = RelativeCSS;