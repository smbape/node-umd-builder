/* jshint node: true */
'use strict';

var babel = require('babel-core');
var anymatch = require('anymatch');
var removeComments = require('../../utils/remove-comments');
var _ = require('lodash');
var sysPath = require('path');
var fs = require('fs');

function BabelCompiler(config) {
    if (!config) config = {};
    var options = config.plugins &&
        (config.plugins.babel || config.plugins.ES6to5) || {};

    this.options = {};
    Object.keys(options).forEach(function(key) {
        if (key === 'sourceMap' || key === 'ignore' || key === 'pretransform') return;
        this.options[key] = options[key];
    }, this);

    this.options.sourceMap = !!config.sourceMaps;

    if (options.ignore) {
        this.isIgnored = anymatch(options.ignore);
    } else if (config.conventions && config.conventions.vendor) {
        this.isIgnored = config.conventions.vendor;
    } else {
        this.isIgnored = anymatch(/^(bower_components|vendor)/);
    }

    if (this.options.pattern) {
        this.pattern = this.options.pattern;
        delete this.options.pattern;
    }
    this.options.presets = this.options.presets || ['es2015'];
    if (this.options.presets.length === 0) {
        delete this.options.presets;
    }

    var buff, e, error, filename, ref, stats;

    filename = sysPath.join(process.cwd(), ".babelrc");

    try {
        stats = fs.statSync(filename);
        if (stats.isFile()) {
            buff = fs.readFileSync(filename);
            this.options = _.defaults(JSON.parse(removeComments(buff.toString())));
        }
    } catch (error) {
        e = error;
        e = e.toString().replace("Error: ENOENT, ", "");
        console.warn(".babelrc parsing error: " + e + ". babel will run with default options.");
    }

    this.pretransform = Array.isArray(options.pretransform) ? options.pretransform : null;
}

BabelCompiler.prototype.brunchPlugin = true;
BabelCompiler.prototype.type = 'javascript';
BabelCompiler.prototype.completer = true;

BabelCompiler.prototype.compile = function(params, callback) {
    if (this.isIgnored(params.path)) return callback(null, params);
    var options = _.defaults({
        filename: params.path
    }, this.options);
    var compiled, transform;

    compiled = params.data;
    if (this.pretransform) {
        for (var i = 0, len = this.pretransform.length; i < len; i++) {
            transform = this.pretransform[i];
            compiled = transform(compiled, options);
        }
    }

    try {
        compiled = babel.transform(compiled, options);
    } catch (err) {
        return callback(err);
    }
    var result = {
        data: compiled.code || compiled
    };

    // Concatenation is broken by trailing comments in files, which occur
    // frequently when comment nodes are lost in the AST from babel.
    result.data += '\n';

    if (compiled.map) result.map = JSON.stringify(compiled.map);
    callback(null, result);
};

module.exports = BabelCompiler;