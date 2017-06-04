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
        {data, path} = params

        try
            options = extend { variable: "root" }, @options, {
                sourceURL: @nameCleaner path
            }

            filename = sysPath.join this.paths.APPLICATION_PATH, path
            options.imports = extend modules.makeModule(filename, module), options.imports

            dst = sysPath.join this.paths.PUBLIC_PATH, this.amdDestination(path, true)
            data = _template(data, options)(options.imports)

            writeData data, dst, (err)->
                next err, params
                return
        catch e
            next e, params

        return

JstCompiler.brunchPluginName = 'jst-server-html-brunch'
