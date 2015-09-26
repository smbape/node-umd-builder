sysPath = require 'path'
_ = require 'lodash'
_.template = require './template'

module.exports = class JstCompiler
    brunchPlugin: true
    type: 'template'
    extension: 'jst'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path
        @options = config.plugins and config.plugins.jst

    compile: (params, next)->
        {data, path, map} = params

        try
            options = _.extend {}, @options, sourceURL: @nameCleaner path
            template = _.template(data, options).source

            data = """
    function factory(require) {
        'use strict';
        return #{template};
    }
            """
            next null, {data, path, map}
        catch e
            next e, {data, path, map}

        return
