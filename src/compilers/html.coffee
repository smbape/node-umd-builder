`/* eslint-disable no-empty-function */`

module.exports = class HtmlCompiler
    brunchPlugin: true
    type: 'template'
    pattern: /\.(?:html?)$/

    constructor: (cfg = {})->
        this.rootPath = cfg.paths.root;
        this.options = cfg.plugins && cfg.plugins.html || {};

    compile: (params, next)->
        {data, path, map} = params
        data = "module.exports = #{JSON.stringify(data)};"

        if this.options.type in ["esm", "common"]
            # data = "#{data}"
        else if this.options.type is "amd"
            data = """
                define(["module"], function(module) {
                    #{data}
                });
            """
        else
            moduleName = path.slice(path.replace(/^.+?[/\/](?:bower_components|node_modules)[/\/]/, ""))
            data = """
                (function(global, factory) {
                    if (typeof define === "function" && define.amd) {
                        define(["module", "handlebars"], factory);
                    } else if (typeof exports === "object" && typeof module !== "undefined") {
                        factory(module);
                    } else {
                        var mod = {
                            exports: {}
                        };
                        factory(mod);
                        global[#{ JSON.stringify(moduleName) }] = mod.exports;
                    }
                })((function(_this) {
                    var g;

                    if (typeof window !== "undefined") {
                        g = window;
                    } else if (typeof global !== "undefined") {
                        g = global;
                    } else if (typeof self !== "undefined") {
                        g = self;
                    } else {
                        g = _this;
                    }

                    return g;
                }(this)), function(module) {
                    #{data}
                });
            """

        next null, {data, path, map}
        return

HtmlCompiler.brunchPluginName = 'html-brunch'
