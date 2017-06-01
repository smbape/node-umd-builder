clone = require("lodash/clone")
defaults = require("lodash/defaults")
each = require("lodash/each")
extend = require("lodash/extend")

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
        @options = defaults {}, options, defaultOptions
        {@overrides} = @options
        delete @options.overrides

        @jstCompiler = new JstCompiler config

    compile: (params, next)->
        {data, path, map} = params

        options = clone @options
        if @overrides
            each @overrides, (override, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    extend options, override
                return

        if 'boolean' is typeof options.jst
            options.jst = on: options.jst

        if options.jst?.on
            if options.jst.holder
                holderStr = options.jst.holder
                holder = new RegExp '(?:<p>)?' + holderStr.replace(SPECIAL_CHAR_REG, '\\$1') + '_(\\d+)(?:</p>)?', 'g'
            else
                holder = /(?:<p>)?@@@_(\d+)(?:<\/p>)?/g
                holderStr = holder.source

            delete options.jst

            jstOptions = @jstCompiler.getOptions path
            holders = []

            {ignore, escape, interpolate, evaluate} = jstOptions
            placeholderFinder = new RegExp '(?:' + ignore.source + '|' + escape.source + '|' + interpolate.source + '|' + evaluate.source + ')', 'g'
            data = data.replace placeholderFinder, (match)->
                replace = holderStr + '_' + holders.length
                holders.push match
                replace

            data = marked(data, options).replace holder, (match, index)->
                holders[parseInt(index, 10)]

            if (options.decorate)
                data = options.decorate(data)

            @jstCompiler.compile {data, path, map}, next

        else
            data = JSON.stringify marked(data, options)

            if (options.decorate)
                data = options.decorate(data)

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

MarkdownCompiler.brunchPluginName = 'markdown-brunch'
