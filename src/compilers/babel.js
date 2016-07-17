/* jshint node: true */
'use strict';

var log4js = global.log4js || (global.log4js = require('log4js')),
    logger = log4js.getLogger('babel');

var babel = require('babel-core');
var anymatch = require('anymatch');
var removeComments = require('../../utils/remove-comments');
var _ = require('lodash');
var sysPath = require('path');
var fs = require('fs');

function BabelCompiler(config) {
    if (!config) config = {};
    var originalOptions = config.plugins && config.plugins.babel,
        options = originalOptions || {},
        hasOptions = false;

    this.options = {};

    Object.keys(options).forEach(function(key) {
        if (key === 'sourceMap' || key === 'ignore' || key === 'pretransform') return;
        this.options[key] = options[key];
        hasOptions = true;
    }, this);

    this.options.sourceMap = !!config.sourceMaps;

    if (options.ignore) {
        this.isIgnored = anymatch(options.ignore);
    } else if (config.conventions && config.conventions.vendor) {
        this.isIgnored = config.conventions.vendor;
    } else {
        this.isIgnored = anymatch(/^(bower_components|vendor)/);
    }

    // if (this.options.pattern) {
    //     this.pattern = this.options.pattern;
    //     delete this.options.pattern;
    // }

    if (Array.isArray(this.options.presets) && this.options.presets.length === 0) {
        delete this.options.presets;
    }

    if (!hasOptions) {
        var buff, e, error, filename, ref, stats;

        filename = sysPath.join(process.cwd(), ".babelrc");

        try {
            stats = fs.statSync(filename);
            if (stats.isFile()) {
                buff = fs.readFileSync(filename);
                this.options = _.defaults(JSON.parse(removeComments(buff.toString())), this.options);
            }
        } catch (error) {
            e = error;
            e = e.toString().replace("Error: ENOENT, ", "");
            console.warn(".babelrc parsing error: " + e + ". babel will run with default options.");
        }
    }

    this.pretransform = Array.isArray(options.pretransform) ? options.pretransform : null;
}

BabelCompiler.brunchPluginName = 'babel-brunch';
BabelCompiler.prototype.brunchPlugin = true;
BabelCompiler.prototype.type = 'javascript';
BabelCompiler.prototype.completer = true;

BabelCompiler.prototype.compile = function(params, callback) {
    if (this.isIgnored(params.path)) return callback(null, params);
    var options = _.defaults({
        // inputSourceMap: params.map ? JSON.parse(params.map.toString()) : undefined,
        filename: params.path
    }, this.options);

    var compiled, transform, toptions;

    compiled = params.data;

    if (this.pretransform) {
        for (var i = 0, len = this.pretransform.length; i < len; i++) {
            transform = this.pretransform[i];
            if (Array.isArray(transform)) {
                toptions = _.extend({}, options, transform[1]);
                transform = transform[0];
            } else {
                toptions = options;
            }
            try {
                compiled = transform(compiled, toptions);
            } catch (err) {
                logger.error(err.message, err.stack);
            }
        }
    }

    try {
        compiled = babel.transform(compiled, options);
    } catch (err) {
        logger.error(err.message, err.stack);
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