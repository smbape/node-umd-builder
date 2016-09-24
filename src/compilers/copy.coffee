log4js = global.log4js || (global.log4js = require('log4js'))
logger = log4js.getLogger 'copy'

fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
semLib = require 'sem-lib'
_ = require 'lodash'

builder = require '../builder'

# 4 parallel copies at most
# a way to control writting bottle neck on a usb key
# which causes editor/explorer to freeze
copySem = semLib.semCreate Math.pow(2, 2), true

# change event is triggered event if the file is not completely written
# add a custom timeout to leave time to initial writting to finish
# usefull for images changes
wait = Math.pow 2, 8
fns = {}
hasProp = Object::hasOwnProperty

_copyFile = (dst, src, plugin, next)->
    copySem.semTake ->
        done = (err)->
            next(err)
            copySem.semGive()
            return

        mkdirp sysPath.dirname(dst), (err)->
            return done(err) if err

            if logger.isDebugEnabled()
                _src = sysPath.relative plugin.paths.APPLICATION_PATH, src
                _dst = sysPath.relative plugin.paths.APPLICATION_PATH, dst
                logger.debug "\n    #{_src}\n    #{_dst}"

            readable = fs.createReadStream src
            writable = fs.createWriteStream dst
            readable.pipe writable

            writable.on 'error', done
            writable.on 'finish', done
            return
        return
    return

copyFile = (dst, src, plugin, done)->
    if hasProp.call fns, dst
        fn = fns[dst]
    else
        fn = fns[dst] = _.throttle _copyFile.bind(null, dst), wait, {leading: false, trailling: false}

    fn.cancel()
    fn(src, plugin, done)
    return

module.exports = class CopyCompiler
    brunchPlugin: true
    type: 'copy'
    typePattern: /^(?!(?:javascript|stylesheet|html)$)/
    typeUndefined: true
    completer: true

    constructor: (config = {})->
        @amdDestination = config.modules.amdDestination
        {@paths} = builder.generateConfig(config)

    compile: (params, done)->
        {data, path, map} = params
        self = @
        src = sysPath.join self.paths.APPLICATION_PATH, path
        dst = sysPath.join self.paths.PUBLIC_PATH, self.amdDestination(path, true)
        copyFile dst, src, @, (err)->
            done err, params
            return

        return

CopyCompiler.brunchPluginName = 'copy-brunch'
