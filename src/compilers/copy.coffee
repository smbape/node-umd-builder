fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
semLib = require 'sem-lib'
log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'copy'
builder = require('../../').builder
_ = require 'lodash'

# 4 parallel copies at most
copySem = semLib.semCreate Math.pow(2, 2), true

# change event is triggered event if the file is not completely written
# add a custom timeout to leave time to initial writting to finish
# usefull for images changes
wait = Math.pow 2, 8
fns = {}
hasOwnProperty = Object::hasOwnProperty
debounce = (plugin, src, dst, next)->
    fns[src] or (fns[src] = {})
    return fns[src][dst] if hasOwnProperty.call fns[src], dst

    fns[src][dst] = _.debounce ->
        copySem.semTake ->
            done = (err)->
                next(err)
                copySem.semGive()
                return

            mkdirp sysPath.dirname(dst), (err)->
                return done(err) if err
                _src = sysPath.relative plugin.paths.APPLICATION_PATH, src
                _dst = sysPath.relative plugin.paths.APPLICATION_PATH, dst
                logger.info "\n    #{_src}\n    #{_dst}"
                readable = fs.createReadStream src
                writable = fs.createWriteStream dst
                readable.pipe writable
                writable.on 'finish', done
                return
            return
        return
    , wait

copyFile = (plugin, src, dst, next)->
    debounce(plugin, src, dst, next)()
    return

module.exports = class AmdCompiler
    brunchPlugin: true
    type: 'copy'
    typePattern: /^(?!(?:javascript|stylesheet)$)/
    typeUndefined: true
    completer: true
    
    constructor: (config = {})->
        # TODO: find a better way to initialize builder with config before starting compilation
        @options = _.extend {}, config
        if config.optimize
            try
                UglifyJSOptimizer = require 'uglify-js-brunch'
                @options.optimizer = new UglifyJSOptimizer config

        @amdDestination = config.modules.amdDestination

    compile: (params, next)->
        # TODO: find a better way to initialize builder with config before starting compilation
        return @_compile params, next if @initialized

        builder.initialize @options, (config)=>
            @paths = config.paths
            @initialized = true
            @_compile params, next
            return

        return

    _compile: (params, next)->
        {data, path, map} = params

        src = sysPath.join @paths.APPLICATION_PATH, path
        dst = sysPath.join @paths.PUBLIC_PATH, @amdDestination(path, true)
        copyFile @, src, dst, (err)->
            next err, params
            return

        return
