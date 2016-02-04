babylon = require('babylon')
_ = require 'lodash'
hasOwn = {}.hasOwnProperty

shiftTransform = (transformations, start, end, offset, leftoffset)->
    if undefined is leftoffset
        leftoffset = 0

    for transformation in transformations
        if transformation[2] >= end
            # previous tranformation ends before end of current transformation
            # end position has been offseted
            transformation[2] += offset
            if transformation[1] >= end
                # previous tranformation ends before start of current transformation
                # start position has been shifted
                transformation[1] += offset

        else if transformation[1] > start
            transformation[1] += leftoffset
            transformation[2] += leftoffset

    return

lookupTransforms = (ast, transformations, stack = [], memo = {level: 0})->
    if Array.isArray ast
        stack.push ast
        for iast in ast
            lookupTransforms iast, transformations, stack, memo
        stack.pop()
    else if _.isObject ast
        if hasOwn.call(ast, 'type') 
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
                            when 'spRepeat'
                                if ast.value.type is 'StringLiteral'
                                    expression = stack[stack.length - 3]
                                    transformations.push ['spRepeat',  expression.start,  expression.end, _.clone(memo), ast]
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
        shiftTransform transformations, start, end, left.length + right.length, left.length
        str
    spRepeat: (str, transformations, start, end, memo, node)->
        value = node.value.value
        ast = babylon.parse(value).program
        if ast.body.length isnt 1 or
        'ExpressionStatement' isnt ast.body[0].type or
        'BinaryExpression' isnt ast.body[0].expression.type or
        'in' isnt ast.body[0].expression.operator
            throw new Error "invalid spRepeat value at #{node.start}, #{node.end}. expecting '(value, key) in obj' or 'element in elements'"

        {start: _start, end: _end} = ast.body[0].expression.left
        args = value.substring _start, _end
        {start: _start, end: _end} = ast.body[0].expression.right
        obj = value.substring _start, _end

        if memo.level < 2
            left = "_.map(#{obj}, function(#{args}) {return ("
            right = ")}.bind(this))"
        else
            left = "{ _.map(#{obj}, function(#{args}) {return ("
            right = ")}.bind(this)) }"

        toRepeat = str.substring(start, node.start) + str.substring(node.end, end)
        leftoffset = left.length - node.end + node.start
        str = str.substring(0, start) + left + toRepeat + right + str.substring(end)
        shiftTransform transformations, start, end, leftoffset + right.length, leftoffset
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
    while trf = transformations.pop()
        name = trf.shift()
        trf.splice 0, 0, str, transformations
        if hasOwn.call fnTransform, name
            str = fnTransform[name].apply null, trf
    str

module.exports = transform
