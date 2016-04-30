sysPath = require 'path'
handlebars = require 'handlebars'

module.exports = class HandlebarsCompiler
    brunchPlugin: true
    type: 'template'
    pattern: /\.(?:hbs|handlebars)$/

    compile: (params, next)->
        {data, path, map} = params

        try
            data = """
    deps = [{node: 'handlebars', common: '!Handlebars', amd: 'handlebars'}];
    function factory(require, Handlebars) {
        return Handlebars.template(#{handlebars.precompile data});
    }
            """
            next null, {data, path, map}
        catch e
            next e, {data, path, map}

        return

HandlebarsCompiler.brunchPluginName = 'handlebars-brunch'
