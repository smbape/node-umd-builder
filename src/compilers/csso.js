'use strict';

var csso = require('csso'),
    _ = require('lodash');

function CssoOptimizer(config) {
    this.options = config && config.plugins && config.plugins.csso || {};
    this.sourceMap = !!config.sourceMaps;
}

CssoOptimizer.prototype.brunchPlugin = true;
CssoOptimizer.prototype.type = 'stylesheet';
CssoOptimizer.prototype.optimize = function(params, callback) {
    var data = params.data,
        map = params.map,
        path = params.path;

    var ignored = this.options.ignored,
        optimized;

    if ('function' === typeof ignored) {
        if (ignored(path)) {
            callback(null, params);
            return;
        }
    } else if (ignored instanceof RegExp) {
        if (ignored.test(path)) {
            callback(null, params);
            return;
        }
    }

    var options = _.extend({
        sourceMap: map || this.sourceMap
    }, this.options, {
        filename: path
    });

    try {
        optimized = csso.minify(data, options);
        callback(null, {
            path: path,
            data: optimized.css,
            map: optimized.map
        });
    } catch (err) {
        callback(err);
    }
};

module.exports = CssoOptimizer;