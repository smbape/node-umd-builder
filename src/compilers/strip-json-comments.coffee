`/* eslint-disable no-empty-function */`
stripJsonComments = require 'strip-json-comments'

class StripJsonCommentsCompiler
    brunchPlugin: true
    type: 'javascript'
    completer: true

    compile: (params, next)->
        { data, path, map } = params

        params.data = data
        next null, {data: stripJsonComments(data), path, map}
        return

module.exports = StripJsonCommentsCompiler
