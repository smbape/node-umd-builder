// copy of https://github.com/brunch/javascript-brunch
// use "progeny": "^0.5.2"
// use brunch 1.8.x compile signature

// """
// @import path
// @import 'path'
// @import "path"
// @import nib
// @import 'nib'
// @import "nib"
// not to match @import not to match
// @import nibar
// @import 'nibar'
// @import "nibar"
// """.match /(?:^|\n)[^\S\n]*(?:@import|@require)\s+['"]?(?!nib\b)([^'"\n]+)['"]?[^\S\n]*/g
// javascript V8 regexp engine does not have start of line special character
// progeny default settings cannot be overrided making it impossible to add patches|extensions
// should any patches be made through a fork of project? Don't know, may be.

'use strict';

var sysPath = require('path');
var stylus = require('stylus');
var nib = require('nib');
var progeny = require('progeny');

function StylusCompiler(cfg) {
    if (cfg == null) cfg = {};
    this.rootPath = cfg.paths.root;
    this.config = (cfg.plugins && cfg.plugins.stylus) || {};
    this.getDependencies = progeny({
        rootPath: this.rootPath,
        reverseArgs: true
    });
}

StylusCompiler.prototype.brunchPlugin = true;
StylusCompiler.prototype.type = 'stylesheet';
StylusCompiler.prototype.extension = 'styl';

StylusCompiler.prototype.compile = function(params, callback) {
    var data = params.data,
        path = params.path,
        map = params.map;

    var cfg = this.config;
    var compiler = stylus(data)
        .set('filename', path)
        .set('compress', false)
        .set('firebug', !!cfg.firebug)
        .set('linenos', !!cfg.linenos)
        .set('include css', !!cfg.includeCss)
        .include(sysPath.dirname(path))
        .include(sysPath.join(this.rootPath))
        .use(nib());
    if (cfg !== {}) {
        var defines = cfg.defines || {};
        var paths = cfg.paths;
        var imports = cfg.imports;
        var plugins = cfg.plugins;
        Object.keys(defines).forEach(function(name) {
            compiler.define(name, defines[name]);
        });
        if (Array.isArray(paths)) {
            paths.forEach(function(path) {
                compiler.include(path);
            });
        }
        if (Array.isArray(imports)) {
            imports.forEach(function(relativePath) {
                compiler['import'](relativePath);
            });
        }
        if (Array.isArray(plugins)) {
            var handler = function(plugin) {
                compiler.use(plugin());
            };
            plugins.forEach(function(pluginName) {
                if (typeof define !== 'undefined' && define.amd) {
                    require([pluginName], handler);
                } else {
                    handler(require(pluginName));
                }
            });
        }
    }
    compiler.render(callback);
};

module.exports = StylusCompiler;