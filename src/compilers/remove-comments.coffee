sysPath = require 'path'
removeComments = require '../../utils/remove-comments'

module.exports = class RemoveCommentsCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true

    compile: (params, next)->
        {data, path, map} = params
        if not (data = removeComments(data))
            console.log path
        params.data = data
        # next null, {data: removeComments(data), path, map}
        next null, params
        return
