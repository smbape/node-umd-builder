/* jshint node: true */
"use strict";

const log4js = global.log4js || (global.log4js = require("log4js"));
const logger = log4js.getLogger("babel");

const babel = require("babel-core");
const anymatch = require("anymatch");
const removeComments = require("../../utils/remove-comments");
const defaults = require("lodash/defaults");
const extend = require("lodash/extend");
const sysPath = require("path");
const fs = require("fs");
const resolve = require("babel-core/lib/helpers/resolve");
const hasProp = Object.prototype.hasOwnProperty;

function BabelCompiler(config) {
    if (config == null) {
        config = {};
    }
    const originalOptions = config.plugins && config.plugins.babel;
    const options = originalOptions || {};
    let hasOptions = false;

    this.options = {};

    Object.keys(options).forEach(function(key) {
        if (key === "sourceMap" || key === "ignore" || key === "pretransform") {
            return;
        }
        this.options[key] = options[key];
        hasOptions = true;
    }, this);

    this.options.sourceMap = Boolean(config.sourceMaps);

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

    if (Array.isArray(this.options.presets) && this.options.presets.length === 0) {
        delete this.options.presets;
    }

    if (!hasOptions) {
        const filename = sysPath.join(process.cwd(), ".babelrc");

        try {
            const stats = fs.statSync(filename);
            if (stats.isFile()) {
                const buff = fs.readFileSync(filename);
                this.options = defaults(JSON.parse(removeComments(buff.toString())), this.options);
            }
        } catch ( err ) {
            err = err.toString().replace("Error: ENOENT, ", "");
            console.warn(".babelrc parsing error: " + err + ". babel will run with default options.");
        }
    }

    // fix preset/plugin path resolution
    const dirname = process.cwd();
    resolveOption("preset", this.options, dirname);
    resolveOption("plugin", this.options, dirname);

    this.pretransform = Array.isArray(options.pretransform) ? options.pretransform : null;
}

function resolveOption(type, options, dirname) {
    if (hasProp.call(options, type + "s")) {
        const config = options[type + "s"];
        if (!Array.isArray(config)) {
            return;
        }

        for (let i = 0, len = config.length; i < len; i++) {
            const name = config[i];
            if ("string" === typeof name) {
                config[i] = babelResolve(type, name, dirname);
            } else if (Array.isArray(name) && "string" === typeof name[0]) {
                name[0] = babelResolve(type, name[0]);
            }
        }
    }
}

function babelResolve(type, name, dirname) {
    return resolve("babel-" + type + "-" + name, dirname) || resolve(type + "-" + name, dirname) || resolve("babel-" + name) || resolve(name) || name;
}

BabelCompiler.brunchPluginName = "babel-brunch";
BabelCompiler.prototype.brunchPlugin = true;
BabelCompiler.prototype.type = "javascript";
BabelCompiler.prototype.completer = true;

BabelCompiler.prototype.compile = function(params, callback) {
    if (this.isIgnored(params.path)) {
        callback(null, params);
        return;
    }

    const options = defaults({
        filename: params.path
    }, this.options);

    let compiled, transform, toptions;

    compiled = params.data;

    if (this.pretransform) {
        for (let i = 0, len = this.pretransform.length; i < len; i++) {
            transform = this.pretransform[i];

            if (Array.isArray(transform)) {
                toptions = extend({}, options, transform[1]);
                transform = transform[0];
            } else {
                toptions = options;
            }

            try {
                compiled = transform(compiled, toptions);
            } catch ( err ) {
                logger.error(err.message, err.stack);
            }
        }
    }

    try {
        compiled = babel.transform(compiled, options);
    } catch ( err ) {
        logger.error(err.message, err.stack);
        callback(err);
        return;
    }

    const result = {
        data: compiled.code || compiled
    };

    // Concatenation is broken by trailing comments in files, which occur
    // frequently when comment nodes are lost in the AST from babel.
    result.data += "\n";

    if (compiled.map) {
        result.map = JSON.stringify(compiled.map);
    }
    callback(null, result);
};

module.exports = BabelCompiler;