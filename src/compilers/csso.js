"use strict";

const csso = require("csso");
const extend = require("lodash/extend");

function CssoOptimizer(config) {
    this.options = config && config.plugins && config.plugins.csso || {};
    this.sourceMap = Boolean(config.sourceMaps);
}

CssoOptimizer.prototype.brunchPlugin = true;
CssoOptimizer.prototype.type = "stylesheet";
CssoOptimizer.prototype.optimize = function(params, callback) {
    const data = params.data;
    const map = params.map;
    const path = params.path;

    const ignored = this.options.ignored;
    let optimized;

    if ("function" === typeof ignored) {
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

    const options = extend({
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