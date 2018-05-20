extend = require("lodash/extend")
each = require("lodash/each")
extend = require("lodash/extend")
template = require './template'
sysPath = require('path')
minimatch = require('minimatch')

module.exports = class JstCompiler
    brunchPlugin: true
    type: 'template'
    extension: 'jst'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path
        @options = config.plugins?.jst or {}
        @overrides = @options.overrides
        delete @options.overrides

    getOptions: (path)->
        options = extend {}, @options, sourceURL: @nameCleaner path
        if @overrides
            each @overrides, (override, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    extend options, override
                return

        options

    compile: (params, next)->
        {data, path, map} = params

        options = @getOptions path

        try
            data = "module.exports = #{template(data, options).source};"
        catch e
            next e, {data, path, map}
            return

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
                    if (typeof module === 'object' && module && module.exports) {
                        factory(module);
                    } else if (typeof define === "function" && define.amd) {
                        define(["module", "handlebars"], factory);
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

JstCompiler.brunchPluginName = 'jst-brunch'
