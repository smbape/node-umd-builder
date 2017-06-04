`/* eslint-disable no-empty-function */`
removeComments = require '../../utils/remove-comments'

class RemoveCommentsCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true

    compile: (params, next)->
        {data, path} = params

        if not (data = removeComments(data))
            console.log path

        params.data = data
        # next null, {data: removeComments(data), path, map}
        next null, params
        return

module.exports = RemoveCommentsCompiler
