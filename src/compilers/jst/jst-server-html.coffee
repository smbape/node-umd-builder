sysPath = require 'path'
_ = require 'lodash'
builder = require('../../../').builder
writeData = require '../../writeData'

_.template = require './template'
_.templateSettings.variable = 'root'
_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g

module.exports = class JstCompiler
    brunchPlugin: true
    type: 'html'
    extension: 'jst'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path
        @options = config.plugins and config.plugins.jst

    compile: (params, next)->
        {data, path, map} = params

        try
            options = _.extend {}, @options, sourceURL: @nameCleaner path
            template = _.template(data, options)

            self.paths = self.paths or builder.getConfig().paths
            src = sysPath.join self.paths.APPLICATION_PATH, path
            dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path, true)
            data = template
                require: require
                __filename: src
                __dirname: sysPath.dirname src

            writeData data, dst, (err)->
                next err, params
                return
        catch e
            next e, params

        return
