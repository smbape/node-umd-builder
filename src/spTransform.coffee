babylon = require('babylon')
_ = require 'lodash'
hasOwn = {}.hasOwnProperty

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
                            when 'spClick'
                                if ast.value.type is 'JSXExpressionContainer'
                                    start = ast.name.start
                                    middle = ast.name.end
                                    end = ast.value.end

                                    transformations.push ['spClick', ast.name.start, ast.name.end, _.clone(memo)]
                                    transformations.push ['spClickValue',  ast.value.start,  ast.value.end, _.clone(memo)]
                                else
                                    throw new Error "spClick attribute at #{ast.start}, #{ast.end} expects a javascript expression"
                            when 'spRepeat'
                                if ast.value.type is 'StringLiteral'
                                    expression = stack[stack.length - 3]
                                    transformations.push ['spRepeat',  expression.start,  expression.end, _.clone(memo), ast]
                                else
                                    throw new Error "spRepeat attribute at #{ast.start}, #{ast.end} expects a string literal as value"
                            when 'spShow'
                                if ast.value.type is 'JSXExpressionContainer'
                                    expression = stack[stack.length - 3]
                                    transformations.push ['spShow',  expression.start,  expression.end, _.clone(memo), ast]
                                else
                                    throw new Error "spShow attribute at #{ast.start}, #{ast.end} expects a javascript expression"

                when 'JSXElement'
                    isJsxElement = true
                    ++memo.level


        stack.push ast
        for own prop of ast
            lookupTransforms ast[prop], transformations, stack, memo
        stack.pop()
        memo.level-- if isJsxElement
    
    return

fnTransform =
    spClick: (str, transformations, start, end)->
        str.substring(0, start) + 'onClick' + str.substring(end)

    spClickValue: (str, transformations, start, end, memo)->
        left = "{ (function(event) "
        right = ").bind(this) }"
        str = str.substring(0, start) + left + str.substring(start, end) + right + str.substring(end)
        shiftTransform transformations, start, end, left.length + right.length, left.length, null, null, memo
        str

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

        if not memo.infn and memo.level > 1
            left = '{ ' + left
            right = right + ' }'

        # console.log 'spRepeat before', str
        str = str.substring(0, start) + left + toRepeat + right + str.substring(end)
        # console.log 'spRepeat after', str

        # attribute has been removed
        leftoffset = left.length
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length
        middle = node.start

        # console.log {
        #     leftoffset
        #     rightoffset
        #     nstart: node.start
        #     nend: node.end
        #     middle
        #     name: transformations[0][0]
        #     start: transformations[0][1]
        #     end: transformations[0][2]
        #     snode: transformations[0][4].start
        #     enode: transformations[0][4].end
        # }

        shiftTransform transformations, start, end, offset, leftoffset, middle, rightoffset, memo

        # console.log {
        #     leftoffset
        #     rightoffset
        #     middle
        #     name: transformations[0][0]
        #     start: transformations[0][1]
        #     end: transformations[0][2]
        #     snode: transformations[0][4].start
        #     enode: transformations[0][4].end
        # }

        str

    spShow: (str, transformations, start, end, memo, node)->
        condition = str.substring node.value.expression.start, node.value.expression.end
        toDisplay = str.substring(start, node.start) + str.substring(node.end, end)

        left = "(#{condition} ? "
        right = " : '')"

        if not memo.infn and memo.level > 1
            left = '{ ' + left
            right = right + ' }'

        # console.log 'spShow before', str
        str = str.substring(0, start) + left + toDisplay + right + str.substring(end)
        # console.log 'spShow after', str

        # attribute has been removed
        leftoffset = left.length
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length
        middle = node.start

        # console.log {
        #     leftoffset
        #     rightoffset
        #     middle
        #     name: transformations[0][0]
        #     start: transformations[0][1]
        #     end: transformations[0][2]
        #     snode: transformations[0][4].start
        #     enode: transformations[0][4].end
        # }

        shiftTransform transformations, start, end, offset, leftoffset, middle, rightoffset, memo, ([name, start, end, memo])->
            memo.infn = true
            return

        # console.log {
        #     leftoffset
        #     rightoffset
        #     middle
        #     name: transformations[0][0]
        #     start: transformations[0][1]
        #     end: transformations[0][2]
        #     snode: transformations[0][4].start
        #     enode: transformations[0][4].end
        # }

        str

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

    # put condition transforms first
    _trf = []
    for trf in transformations
        if trf[0] is 'spShow'
            _trf.push trf
        else
            _trf.unshift trf
    transformations = _trf

    while trf = transformations.pop()
        name = trf.shift()
        trf.splice 0, 0, str, transformations
        if hasOwn.call fnTransform, name
            str = fnTransform[name].apply null, trf
    str

module.exports = transform
