
sysPath = require 'path'
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

builder = require('../../').builder
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
        options = config.plugins and config.plugins.markdown or {}
        for prop of defaultOptions
            options[prop] = defaultOptions[prop] if not options[prop]
        marked.setOptions options
        @amdDestination = config.modules.amdDestination

    compile: (params, next)->
        self = @
        {data, path, map} = params
        self.paths = self.paths or builder.getConfig().paths

        dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path) + '.html'
        # escape every curly braces to avoid interpretation by angular
        writeData marked(data).replace(/(\{|\}){2}/g, "{{ '\\$1\\$1' }}"), dst, (err)->
            return next(err) if err
            next err, params
            return

        return
