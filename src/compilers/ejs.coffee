sysPath = require 'path'
ejs = require 'ejs'

search = do ->
    specialRegChar = /([\\/^$.|?*+()\[\]{}])/g

    anonymousFnMath = "function anonymous(locals, escape, include, rethrow) {".replace specialRegChar, '\\$1'
    rethrowFnMatch = "rethrow = rethrow || ".replace specialRegChar, '\\$1'
    escapeFnMatch = "escape = escape || function (markup)".replace specialRegChar, '\\$1'

    new RegExp [
        anonymousFnMath
        '\\n'
        rethrowFnMatch
        "([\\s\\S]+?\\n)"
        escapeFnMatch
    ].join ''

replace = 'return function template(root){\n$1function escape(markup)'

module.exports = class EjsCompiler
    brunchPlugin: true
    type: 'template'
    extension: 'ejs'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path

    compile: (params, next)->
        {data, path, map} = params

        try
            options =
                client: true
                _with: false
                filename: @nameCleaner path

            template = ejs.compile data, options
            template = template.toString().replace search, replace

            data = """
    function factory(require) {
        'use strict';
        function include(path, context) {
            var template = require(path);
            return template(context);
        }
        #{template}
    }
            """
            next null, {data, path, map}
        catch e
            next e, {data, path, map}

        return

EjsCompiler.brunchPluginName = 'ejs-brunch'