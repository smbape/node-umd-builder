_ = require 'lodash'
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

defaultOptions =
    # renderer: new marked.Renderer()
    langPrefix: 'hljs lang-'
    highlight: (code, lang) ->
        if lang is 'auto' or languages.indexOf(lang) is -1
            hljs.highlightAuto(code).value
        else
            hljs.highlight(lang, code).value

module.exports = class MarkdownCompiler
    brunchPlugin: true
    type: 'template'
    pattern: /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/

    constructor: (config = {})->
        @sourceMaps = !!config.sourceMaps
        options = config.plugins and config.plugins.markdown or {}
        @options = _.extend {}, options, defaultOptions

    compile: (params, next)->
        {data, path, map} = params

        data = JSON.stringify marked data, @options

        data = """(function() {
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
        })();"""

        next null, {data, path, map}
        return
