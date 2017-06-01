extend = require("lodash/extend")
each = require("lodash/each")
extend = require("lodash/extend")
_template = require './template'
sysPath = require('path')
minimatch = require('minimatch')

module.exports = class JstCompiler
    brunchPlugin: true
    type: 'template'
    extension: 'jst'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path
        @options = config.plugins?.jst or {}
        @overrides = @options.overrides
        delete @options.overrides

    getOptions: (path)->
        options = extend {}, @options, sourceURL: @nameCleaner path
        if @overrides
            each @overrides, (override, pattern) ->
                if minimatch sysPath.normalize(path), pattern, {nocase: true, matchBase: true}
                    extend options, override
                return

        options

    compile: (params, next)->
        {data, path, map} = params

        options = @getOptions path

        try
            template = _template(data, options).source

            strict = if options.strict
                "'use strict';"
            else
                ''

            data = """
                function factory(require) {
                    #{strict}
                    return #{template};
                }
            """
            next null, {data, path, map}
        catch e
            next e, {data, path, map}

        return

JstCompiler.brunchPluginName = 'jst-brunch'
