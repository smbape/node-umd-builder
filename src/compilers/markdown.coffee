umd = require 'umd-wrapper'
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

defaultOptions =
    renderer: new marked.Renderer()
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
        for prop of defaultOptions
            options[prop] = defaultOptions[prop] if not options[prop]
        marked.setOptions options

    compile: (params, next)->
        {data, path, map} = params

        data = umd JSON.stringify marked data
        data = "(function(){ #{data} }());"

        next null, {data, path, map}
        return
