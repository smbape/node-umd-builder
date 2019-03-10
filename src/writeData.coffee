fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
fcache = require '../utils/fcache'

writeData = (data, dst, cb)->
    fcache.lock dst, (release)->
        next = (err)->
            release()
            cb(err)
            return

        mkdirp sysPath.dirname(dst), (err)->
            if err
                next(err)
                return

            writable = fs.createWriteStream dst
            writable.write data, 'utf8', next
            writable.end()

            return
        return
    return

module.exports = writeData