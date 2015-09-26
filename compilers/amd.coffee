log4js = global.log4js || (global.log4js = require('log4js'))
fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
semLib = require 'sem-lib'
logger = log4js.getLogger 'AmdCompiler'
builder = require '../builder'

customUmdWrapper = (data)->
    """
    (function(require) {
        var deps;

        #{data}

        if (typeof process === 'object' && typeof process.platform !== 'undefined') {
            // NodeJs
            module.exports = depsLoader.common.call(this, require, 'node', deps, factory);
        } else if (typeof define === 'function' && define.amd) {
            // AMD
            depsLoader.amd.call(this, deps, factory);
        }
    }.call(this, require));
    """

# 8 parallel write at most
writeSem = semLib.semCreate Math.pow(2, 3), true
writeData = (data, dst)->
    writeSem.semTake ->
        done = (err)->
            writeSem.semGive()
            return
        
        mkdirp sysPath.dirname(dst), (err)->
            return done(err) if err
            writeStream = fs.createWriteStream dst
            writeStream.write data, 'utf8', done
            writeStream.end()
            return
        return
    return

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true
    
    constructor: (config = {})->
        # logger.info require('util').inspect config, {colors: true, depth: 10}
        # TODO: find a better way to initialize builder with config before starting compilation
        picked = [
            'jsExtensions'
            'paths'
            'links'
        ]
        @options = {}
        for opt in picked
            @options[opt] = config[opt]

        @sourceMaps = !!config.sourceMaps
        @amdDestination = config.modules.amdDestination
        @isCustomUmdModule = config.modules.isCustomUmdModule

    compile: (params, next)->
        return @_compile params, next if @initialized

        builder.initialize @options, (config)=>
            @paths = config.paths
            @initialized = true
            @_compile params, next
            return

        return

    _compile: (params, next)->
        next null, params
        {data, path, map} = params

        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path) + '.js'

        if @isCustomUmdModule path, data
            data = customUmdWrapper data

        writeData data, dst

        return
