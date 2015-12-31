umd = require 'umd-wrapper'
marked = require 'marked'
hljs = require 'highlight.js'
languages = hljs.listLanguages()

fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
semLib = require 'sem-lib'
builder = require('../../').builder

# 8 parallel write at most
writeSem = semLib.semCreate Math.pow(2, 3), true
writeData = (data, dst, done)->
    writeSem.semTake ->
        next = (err)->
            writeSem.semGive()
            done(err)
            return
        
        mkdirp sysPath.dirname(dst), (err)->
            return next(err) if err
            writeStream = fs.createWriteStream dst
            writeStream.write data, 'utf8', next
            writeStream.end()
            return
        return
    return

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
    type: 'markdown-html'
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
        writeData """<span class="mkd">#{marked(data)}</div>""", dst, (err)->
            return next(err) if err
            next err, params
            return

        return
