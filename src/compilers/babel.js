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
        if (key === 'sourceMap' || key === 'ignore') return;
        this.options[key] = options[key];
    }, this);

    this.options.sourceMap = !!config.sourceMaps;
    this.isIgnored = options.ignore ? anymatch(options.ignore) : config.conventions && config.conventions.vendor ? config.conventions.vendor : anymatch(/^(bower_components|vendor)/);
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

}

BabelCompiler.prototype.brunchPlugin = true;
BabelCompiler.prototype.type = 'javascript';
BabelCompiler.prototype.completer = true;

BabelCompiler.prototype.compile = function(params, callback) {
    if (this.isIgnored(params.path)) return callback(null, params);
    this.options.filename = params.path;
    var compiled;
    try {
        compiled = babel.transform(params.data, this.options);
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