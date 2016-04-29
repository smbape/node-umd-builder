_ = require 'lodash'
JstCompiler = require './jst/jst'
sysPath = require('path')
minimatch = require('minimatch')
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

SPECIAL_CHAR_REG = new RegExp '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g'

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
        options = config?.plugins?.markdown or {}
        @options = _.extend {}, options, defaultOptions
        {@overrides} = @options
        delete @options.overrides

        @jstCompiler = new JstCompiler config

    compile: (params, next)->
        {data, path, map} = params

        options = _.clone @options
        if @overrides
            _.each @overrides, (override, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    _.extend options, override
                return

        if 'boolean' is typeof options.jst
            options.jst = on: true

        if options.jst?.on
            if options.jst.holder
                holderStr = options.jst.holder
                holder = new RegExp holderStr.replace(SPECIAL_CHAR_REG, '\\$1'), 'g'
            else
                holder = /@@@/g
                holderStr = holder.source

            delete options.jst

            jstOptions = @jstCompiler.getOptions path
            holders = []

            {ignore, escape, interpolate, evaluate} = jstOptions
            placeholderFinder = new RegExp '(?:' + ignore.source + '|' + escape.source + '|' + interpolate.source + '|' + evaluate.source + ')', 'g'
            data = data.replace placeholderFinder, (match)->
                holders.push match
                holderStr

            index = 0
            data = marked(data, options).replace holder, ->
                holders[index++]

            @jstCompiler.compile {data, path, map}, next

        else
            data = JSON.stringify marked(data, options)

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

            next null, {data, params, map}

        return
