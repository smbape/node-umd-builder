`/* eslint-disable no-empty-function */`

module.exports = class HtmlCompiler
    brunchPlugin: true
    type: 'template'
    pattern: /\.(?:html?)$/

    compile: (params, next)->
        {data, path, map} = params

        data = """
            /* eslint-disable consistent-return */
            (function() {
                var __templateData = #{JSON.stringify(data)};
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
