
sysPath = require 'path'
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

builder = require '../builder'
writeData = require '../writeData'

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
    type: 'html'
    pattern: /\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)$/

    constructor: (config = {})->
        @sourceMaps = !!config.sourceMaps
        options = config?.plugins?.markdown or {}
        @options = _.extend {}, options, defaultOptions
        {@overrides} = @options
        delete @options.overrides
        @amdDestination = config.modules.amdDestination

    compile: (params, next)->
        {data, path, map} = params

        options = _.clone @options
        if @overrides
            _.each @overrides, (override, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    _.extend options, override
                return

        @paths = @paths or builder.getConfig().paths

        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path) + '.html'

        if options.angular
            # escape every curly braces to avoid interpretation by angular
            data = marked(data, options).replace(/(\{|\}){2}/g, "{{ '\\$1\\$1' }}")
        else
            data = marked(data, options)

        writeData data, dst, (err)->
            return next(err) if err
            next err, params
            return

        return
