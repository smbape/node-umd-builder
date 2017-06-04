fs = require 'fs'
mkdirp = require 'mkdirp'
sysPath = require 'path'
semLib = require 'sem-lib'

# 8 parallel write at most
writeSem = semLib.semCreate Math.pow(2, 3), true
writeData = (data, dst, done)->
    writeSem.semTake ->
        next = (err)->
            writeSem.semGive()
            done(err)
            return

        mkdirp sysPath.dirname(dst), (err)->
            if err
                next(err)
                return

            writeStream = fs.createWriteStream dst
            writeStream.write data, 'utf8', next
            writeStream.end()

            return
        return
    return

module.exports = writeData