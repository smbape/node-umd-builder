sysPath = require 'path'
builder = require('../../../').builder
writeData = require '../../writeData'

extend = require("lodash/extend")
_template = require './template'

modules = require("../../../utils/modules")

module.exports = class JstCompiler
    brunchPlugin: true
    type: 'html'
    extension: 'jst'

    constructor: (config = {})->
        @nameCleaner = config.modules.nameCleaner or (path)-> path
        @options = config.plugins and config.plugins.jst
        {@paths} = builder.generateConfig(config)

    compile: (params, next)->
        {data, path, map} = params

        try
            options = extend { variable: "root" }, @options, {
                sourceURL: @nameCleaner path
            }

            options.imports = extend modules.makeModule(filename, module), options.imports

            src = sysPath.join self.paths.APPLICATION_PATH, path
            dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path, true)
            data = _template(data, options)()

            writeData data, dst, (err)->
                next err, params
                return
        catch e
            next e, params

        return

JstCompiler.brunchPluginName = 'jst-server-html-brunch'
