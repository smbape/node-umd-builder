// copy of https://github.com/brunch/stylus-brunch

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

const sysPath = require("path");
const stylus = require("stylus");
const progeny = require("progeny");

class StylusCompiler {
    constructor(cfg) {
        if (cfg == null) {cfg = {};}
        this.rootPath = cfg.paths.root;
        this.config = cfg.plugins && cfg.plugins.stylus || {};
        this.getDependencies = progeny({
            rootPath: this.rootPath,
            reverseArgs: true
        });
        this.sourceMap = Boolean(cfg.sourceMaps);
    }

    compile({data, path, map}, callback) {
        const cfg = this.config;

        const compiler = stylus(data).
            set("filename", path).
            set("compress", false).
            set("firebug", Boolean(cfg.firebug)).
            set("linenos", Boolean(cfg.linenos)).
            set("include css", Boolean(cfg.includeCss)).
            set("sourcemap", this.sourceMap).
            include(sysPath.dirname(path)).
            include(this.rootPath);

        if (cfg !== {}) {
            const defines = cfg.defines || {};
            const paths = cfg.paths;
            const imports = cfg.imports;
            const plugins = cfg.plugins;
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
                    compiler.import(relativePath);
                });
            }
            if (Array.isArray(plugins)) {
                const handler = function(plugin) {
                    compiler.use(plugin());
                };

                plugins.forEach(function(plugin) {
                    if (typeof plugin === "string") {
                        handler(require(plugin));
                    } else {
                        compiler.use(plugin);
                    }
                });
            }
        }

        compiler.render(function(err, data) {
            // empty string will make the next compiler to have source, not compiled
            if (data === "") {
                data = "\n";
            }
            callback(err, {
                path: path,
                data: data,
                map: compiler.sourcemap || map
            });
        });
    }
}

StylusCompiler.brunchPluginName = "stylus-brunch";
StylusCompiler.prototype.brunchPlugin = true;
StylusCompiler.prototype.type = "stylesheet";
StylusCompiler.prototype.extension = "styl";

module.exports = StylusCompiler;