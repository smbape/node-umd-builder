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
        data = JSON.stringify(data)

        if this.options.type is "common"
            data = "module.exports = #{data};"
        else if this.options.type is "amd"
            data = """
                define([], function() {
                    return #{data};
                });
            """
        else
            data = """
                /* eslint-disable consistent-return */
                (function() {
                    var __templateData = #{data};
                    if (typeof define === 'function' && define.amd) {
                        define([], function() {
                            return __templateData;
                        });
                    } else if (typeof module === 'object' && module && module.exports) {
                        module.exports = __templateData;
                    } else {
                        return __templateData;
                    }
                })();
            """

        next null, {data, path, map}
        return

HtmlCompiler.brunchPluginName = 'html-brunch'
