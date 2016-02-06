babylon = require('babylon')
escodegen = require('escodegen')
_ = require 'lodash'
hasOwn = {}.hasOwnProperty
isDedugEnabled = false

shiftRange = (prevStart, prevEnd, start, end, offset, leftoffset, middle, rightoffset)->
    if prevEnd > end
        # previous transformation ends before end of current transformation
        # end position has been offseted
        prevEnd += offset
        if prevStart >= end
            # previous transformation ends before start of current transformation
            # start position has been shifted
            prevStart += offset

    else if prevStart >= start
        if middle
            if prevStart > middle
                prevStart += rightoffset
                prevEnd += rightoffset
            else if prevEnd <= middle
                prevStart += leftoffset
                prevEnd += leftoffset
            else
                prevStart += leftoffset
                prevEnd += rightoffset
        else
            prevStart += leftoffset
            prevEnd += leftoffset

    return [prevStart, prevEnd]

shiftTransform = (transformations, start, end, offset, leftoffset, middle, rightoffset, memo, callback = ->)->
    for node in memo.flattern
        [newStart, newEnd] = shiftRange node.start, node.end, start, end, offset, leftoffset, middle, rightoffset
        node.start = newStart
        node.end = newEnd

    for transformation in transformations
        [newStart, newEnd] = shiftRange transformation[1], transformation[2], start, end, offset, leftoffset, middle, rightoffset
        transformation[1] = newStart
        transformation[2] = newEnd
        callback(transformation)

    return

hasAttriute = (name, attributes)->
    attributes.some (node)->
        node.name.name is name

cid = 0
lookupTransforms = (ast, transformations, stack = [], memo = {level: 0, flattern: []})->
    if Array.isArray ast
        stack.push ast
        for iast in ast
            lookupTransforms iast, transformations, stack, memo
        stack.pop()
    else if _.isObject ast
        if hasOwn.call(ast, 'type')
            ast.cid = ++cid
            memo.flattern.push ast
            switch ast.type
                when 'JSXAttribute'
                    if ast.name.type is 'JSXIdentifier'
                        switch ast.name.name
                            when 'spRepeat'
                                if ast.value.type is 'StringLiteral'
                                    expression = stack[stack.length - 3]
                                    attributes = stack[stack.length - 1].map (node)-> node.name.name
                                    transformations.push [ast.name.name,  expression.start,  expression.end, _.extend({expression, attributes}, memo), ast]
                                else
                                    throw new Error "#{ast.name.name} attribute at #{ast.start}, #{ast.end} expects a string literal as value"
                            when 'spShow'
                                if ast.value.type is 'JSXExpressionContainer'
                                    expression = stack[stack.length - 3]
                                    attributes = stack[stack.length - 1].map (node)-> node.name.name
                                    transformations.push [ast.name.name,  expression.start,  expression.end, _.extend({expression, attributes}, memo), ast]
                                else
                                    throw new Error "#{ast.name.name} attribute at #{ast.start}, #{ast.end} expects a javascript expression"
                            when 'spModel'
                                if ast.value.type is 'JSXExpressionContainer'
                                    transformations.push [ast.name.name, ast.value.expression.start, ast.value.expression.end, _.clone(memo), ast.value.expression]
                                else if ast.value.type isnt 'StringLiteral'
                                    throw new Error "#{ast.name.name} attribute at #{ast.start}, #{ast.end} expects a string literal or a javascript expression"
                            else
                                if hasOwn.call TRF_DICT, ast.name.name
                                    if ast.value.type is 'JSXExpressionContainer'
                                        start = ast.name.start
                                        middle = ast.name.end
                                        end = ast.value.end

                                        transformations.push [ast.name.name, ast.name.start, ast.name.end, _.clone(memo)]
                                        transformations.push [ast.name.name + 'Value',  ast.value.start,  ast.value.end, _.clone(memo)]
                                    else
                                        throw new Error "#{ast.name.name} attribute at #{ast.start}, #{ast.end} expects a javascript expression"

                when 'JSXElement'
                    isJsxElement = true
                    ++memo.level


        stack.push ast
        for own prop of ast
            lookupTransforms ast[prop], transformations, stack, memo
        stack.pop()
        memo.level-- if isJsxElement
    
    return

TRF_DICT =
    spRepeat: (str, transformations, start, end, memo, node)->
        value = node.value.value
        ast = babylon.parse(value).program
        if ast.body.length isnt 1 or
        'ExpressionStatement' isnt ast.body[0].type or
        'BinaryExpression' isnt ast.body[0].expression.type or
        'in' isnt ast.body[0].expression.operator
            throw new Error "invalid spRepeat value at #{node.start}, #{node.end}. expecting '(value, key) in obj' or 'element in elements'"

        toRepeat = str.substring(start, node.start) + str.substring(node.end, end)

        {start: _start, end: _end} = ast.body[0].expression.left
        args = value.substring _start, _end
        {start: _start, end: _end} = ast.body[0].expression.right
        obj = value.substring _start, _end

        left = "_.map(#{obj}, function(#{args}) {return ("
        right = ")}.bind(this))"

        # left = "(function(__obj){(__obj.map || _.map).call(__obj, __obj, function(#{args}) {return ("
        # right = ")}.bind(this)).call(this, #{obj})"
        
        if ~memo.attributes.indexOf('spShow')
            left = left.substring(0, left.length - 1)
            right = right.substring(1)

        if memo.level > 1
            left = '{ ' + left
            right = right + ' }'

        prefix = str.substring(0, start)
        suffix = str.substring(end)

        res = prefix + left + toRepeat + right + suffix

        # attribute has been removed
        leftoffset = left.length
        middle = node.start
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length

        if isDedugEnabled
            console.log {
                name: 'spRepeat'
                before: str
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        shiftTransform transformations, start, end, offset, leftoffset, middle, rightoffset, memo

        if isDedugEnabled
            console.log {
                name: 'spRepeat'
                after: res
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        res

    spShow: (str, transformations, start, end, memo, node)->
        condition = str.substring node.value.expression.start, node.value.expression.end
        toDisplay = str.substring(start, node.start) + str.substring(node.end, end)

        left = "(#{condition} ? "
        right = " : '')"

        if memo.attributes.indexOf('spRepeat') is -1 and memo.level > 1
            left = '{ ' + left
            right = right + ' }'

        res = str.substring(0, start) + left + toDisplay + right + str.substring(end)

        # attribute has been removed
        leftoffset = left.length
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length
        middle = node.start

        if isDedugEnabled
            console.log {
                name: 'spShow'
                before: str
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        shiftTransform transformations, start, end, offset, leftoffset, middle, rightoffset, memo, ([name, start, end, memo])->
            memo.infn = true
            return

        if isDedugEnabled
            console.log {
                name: 'spShow'
                after: res
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        res

    spModel: (str, transformations, start, end, memo, expr)->
        value = str.substring(start, end)
        ast = babylon.parse(value).program

        if ast.body.length is 1 and ast.body[0].type is 'ExpressionStatement'
            switch ast.body[0].expression.type
                when 'MemberExpression'
                    {object, property} = ast.body[0].expression

                    property.end -= property.start
                    property.start = 0

                    object = escodegen.generate object
                    property = escodegen.generate property
                when 'ArrayExpression'
                    return str
                else
                    throw new Error "spModel attribute must be an ExpressionStatement at (#{expr.start}:#{expr.end}) with a MemberExpression or an ArrayExpression"
        else
            throw new Error "spModel attribute at (#{expr.start}:#{expr.end}) must be an ExpressionStatement"

        value = "[#{object}, '#{property.replace(/'/g, "\\'")}']"
        res = str.substring(0, start) + value + str.substring(end)

        offset = value.length - end + start
        leftoffset = offset
        middle = null
        rightoffset = null

        if isDedugEnabled
            console.log {
                name: 'spModel'
                before: str
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        shiftTransform transformations, start, end, offset, leftoffset, null, null, memo

        if isDedugEnabled
            console.log {
                name: 'spModel'
                after: res
                offset
                leftoffset
                rightoffset
                trf: if transformations[0]
                    name: transformations[0][0]
                    start: transformations[0][1]
                    end: transformations[0][2]
                    snode: transformations[0][4]?.start
                    enode: transformations[0][4]?.end
                else
                    null
            }

        res

do ->
    delegateEvents = [
        'blur'
        'change'
        'click'
        'drag'
        'drop'
        'focus'
        'input'
        'load'
        'mouseenter'
        'mouseleave'
        'mousemove'
        'propertychange'
        'reset'
        'scroll'
        'submit'

        'abort'
        'canplay'
        'canplaythrough'
        'durationchange'
        'emptied'
        'encrypted'
        'ended'
        'error'
        'loadeddata'
        'loadedmetadata'
        'loadstart'
        'pause'
        'play'
        'playing'
        'progress'
        'ratechange'
        'seeked'
        'seeking'
        'stalled'
        'suspend'
        'timeupdate'
        'volumechange'
        'waiting'
    ]

    delegate = (type)->
        type = type[0].toUpperCase() + type.substring(1)

        TRF_DICT['sp' + type] = (str, transformations, start, end)->
            str.substring(0, start) + 'on' + type + str.substring(end)

        TRF_DICT['sp' + type + 'Value'] = (str, transformations, start, end, memo)->
            left = "{ (function(event) "
            right = ").bind(this) }"
            res = str.substring(0, start) + left + str.substring(start, end) + right + str.substring(end)

            offset = left.length + right.length
            leftoffset = left.length
            middle = null
            rightoffset = null

            if isDedugEnabled
                console.log {
                    name: 'sp' + type
                    before: str
                    offset
                    leftoffset
                    rightoffset
                    trf: if transformations[0]
                        name: transformations[0][0]
                        start: transformations[0][1]
                        end: transformations[0][2]
                        snode: transformations[0][4]?.start
                        enode: transformations[0][4]?.end
                    else
                        ''
                }

            shiftTransform transformations, start, end, offset, leftoffset, middle, rightoffset, memo

            if isDedugEnabled
                console.log {
                    name: 'sp' + type
                    after: res
                    offset
                    leftoffset
                    rightoffset
                    trf: if transformations[0]
                        name: transformations[0][0]
                        start: transformations[0][1]
                        end: transformations[0][2]
                        snode: transformations[0][4]?.start
                        enode: transformations[0][4]?.end
                    else
                        ''
                }

            res
        return


    for evt in delegateEvents
        delegate evt

    return

parse = (str)->
    babylon.parse str, plugins: [
        'jsx'
        'flow'
    ]

transform = (str, options)->
    ast = parse str
    # console.log JSON.stringify ast, null, 4
    transformations = []
    lookupTransforms ast, transformations
    priorities =
        spShow: []
        spRepeat: []

    _trf = []
    for trf in transformations
        switch trf[0]
            when 'spShow'
                priorities.spShow.push trf
            when 'spRepeat'
                priorities.spRepeat.push trf
            else
                _trf.push trf

    # spRepeat, spShow, others
    transformations = _trf.concat priorities.spShow, priorities.spRepeat

    while trf = transformations.pop()
        name = trf.shift()
        trf.splice 0, 0, str, transformations
        if hasOwn.call TRF_DICT, name
            str = TRF_DICT[name].apply null, trf
    str

module.exports = transform
