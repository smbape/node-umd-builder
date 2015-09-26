// jshint node: true

'use strict';

var log4js = global.log4js || (global.log4js = require('log4js'));
var logger = log4js.getLogger('relative-css');

var CleanCSS = require('clean-css');
var sysPath = require('path');
var util = require('util');

function RelativeCSS(config) {
    if (config == null) config = {};
    this.sourceMap = !!config.sourceMaps;
    this.amdDestination = config.modules.amdDestination;
    // this.root = sysPath.resolve(__dirname, '..', '..', config.paths.root);
    this.root = config.paths.root;

    // TODO : find an unabiguous way to get it from config if possible
    this.target = sysPath.join(this.root, 'stylesheets', 'app.css');
}

RelativeCSS.prototype.brunchPlugin = true;
RelativeCSS.prototype.type = 'stylesheet';
RelativeCSS.prototype.completer = true;

RelativeCSS.prototype.compile = function(params, callback) {
    var error, minified, result, options;

    var data = params.data,
        path = params.path,
        map = params.map,
        destination = sysPath.join(this.root, this.amdDestination(path, true)),
        source = sysPath.relative(sysPath.dirname(this.target), destination).replace(/[\\]/g, '/');

    options = {
        // root: this.root,
        target: this.target,
        relativeTo: sysPath.dirname(destination),
        sourceMap: map || this.sourceMap
    };

    try {
        if (map) {
            logger.info('map', destination);
        }

        // TODO : fix source map
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
        if (minified.errors.length > 0) {
            error = minified.errors;
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
    } catch (_error) {
        error = "CSS minify failed on " + path + ": " + _error;
    } finally {
        if (error) {
            logger.error(error);
        }
        callback(error, result || params);
    }
};

module.exports = RelativeCSS;