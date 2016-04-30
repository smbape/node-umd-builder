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

shiftTransform = ([name, str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state)->
    if isDedugEnabled
        console.log {
            name: name
            start
            end
            level: state.level
            inExpression: state.inExpression
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

    for node in state.flattern
        [newStart, newEnd] = shiftRange node.start, node.end, start, end, offset, leftoffset, middle, rightoffset
        node.start = newStart
        node.end = newEnd

    for transformation in transformations
        [newStart, newEnd] = shiftRange transformation[1], transformation[2], start, end, offset, leftoffset, middle, rightoffset
        transformation[1] = newStart
        transformation[2] = newEnd

    if isDedugEnabled
        console.log {
            name: name
            start
            end
            level: state.level
            inExpression: state.inExpression
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

    return

strReplace = (name, str, replace, start, end, transformations, state)->
    res = str.substring(0, start) + replace + str.substring(end)

    offset = replace.length - end + start
    leftoffset = offset
    middle = null
    rightoffset = null

    shiftTransform [name, str, res], transformations, start, end, offset, leftoffset, null, null, state

    res


hasAttriute = (name, attributes)->
    attributes.some (node)->
        node.name.name is name

EXPRESSION_REG = /Expression/
cid = 0
lookupTransforms = (ast, transformations, state = {level: 0, flattern: []}, astStack = [], stateStack = [])->
    delete state.attribute
    if Array.isArray ast
        astStack.push ast
        stateStack.push _.clone(state)
        for iast in ast
            lookupTransforms iast, transformations, state, astStack, stateStack
        stateStack.pop()
        astStack.pop()
    else if _.isObject ast
        if hasOwn.call(ast, 'type')
            ast.cid = ++cid
            state.flattern.push ast
            switch ast.type
                when 'JSXAttribute'
                    if isDedugEnabled
                        console.log 'start', {type: ast.type, start: ast.start, end: ast.end, level: state.level}

                    inExpression = stateStack[stateStack.length - 4].inExpression
                    attribute = state.attribute = ast.name.name
                    currState = _.defaults {inExpression}, state
                    if ast.name.type is 'JSXIdentifier'
                        switch attribute
                            when 'spRepeat'
                                if ast.value.type is 'StringLiteral' or (ast.value.type is 'JSXExpressionContainer' and ast.value.expression.type is 'NumericLiteral')
                                    expression = currState.expression = astStack[astStack.length - 3]
                                    attributes = currState.attributes = astStack[astStack.length - 1].map (node)-> node.name.name
                                    transformations.push [attribute, expression.start, expression.end, currState, ast]
                                else
                                    console.log ast.value.expression
                                    throw new Error "#{attribute} attribute at #{ast.start}, #{ast.end} expects a string literal as value"
                            when 'spShow'
                                if ast.value.type is 'JSXExpressionContainer'
                                    expression = currState.expression = astStack[astStack.length - 3]
                                    attributes = currState.attributes = astStack[astStack.length - 1].map (node)-> node.name.name
                                    transformations.push [attribute, expression.start, expression.end, currState, ast]
                                else
                                    throw new Error "#{attribute} attribute at #{ast.start}, #{ast.end} expects a javascript expression"
                            when 'spModel'
                                if ast.value.type is 'JSXExpressionContainer'
                                    transformations.push [attribute, ast.value.expression.start, ast.value.expression.end, currState, ast.value.expression]
                                else if ast.value.type isnt 'StringLiteral'
                                    throw new Error "#{attribute} attribute at #{ast.start}, #{ast.end} expects a string literal or a javascript expression"
                            else
                                if hasOwn.call TRF_DICT, attribute
                                    if ast.value.type is 'JSXExpressionContainer'
                                        start = ast.name.start
                                        middle = ast.name.end
                                        end = ast.value.end

                                        transformations.push [attribute, ast.name.start, ast.name.end, currState]
                                        transformations.push [attribute + 'Value', ast.value.start, ast.value.end, currState]
                                    else
                                        throw new Error "#{attribute} attribute at #{ast.start}, #{ast.end} expects a javascript expression"

                when 'JSXElement'
                    if isDedugEnabled
                        console.log 'start', {type: ast.type, start: ast.start, end: ast.end, level: state.level}

                    prevInExpression = state.inExpression
                    inExpression = state.inExpression = false
                    ++state.level

                when 'JSXOpeningElement'
                    if ast.attributes and ast.name?.name and /[a-z]/.test(ast.name.name[0])
                        attributes = ast.attributes.filter (node)-> node.name?.name is 'className'
                        if attributes.length
                            value = attributes[attributes.length - 1].value
                            if value.type is 'StringLiteral' and /(?:^|\s)mdl-/.test value.value
                                transformations.push ['mdlOpen', ast.name.start, ast.name.end, state]
                                if not ast.selfClosing
                                    closingElement = astStack[astStack.length - 1].closingElement.name
                                    transformations.push ['mdlClose', closingElement.start, closingElement.end, state]
                else
                    if EXPRESSION_REG.test ast.type
                        if isDedugEnabled
                            console.log 'start', {type: ast.type, start: ast.start, end: ast.end, level: state.level}

                        prevInExpression = state.inExpression
                        inExpression = state.inExpression = true

        astStack.push ast
        stateStack.push _.clone(state)
        for own prop of ast
            lookupTransforms ast[prop], transformations, state, astStack, stateStack
        stateStack.pop()
        astStack.pop()

        if inExpression
            if isDedugEnabled
                console.log 'end', {type: ast.type, start: ast.start, end: ast.end, level: state.level}
            state.inExpression = prevInExpression
        else if ast.type is 'JSXElement'
            if isDedugEnabled
                console.log 'end', {type: ast.type, start: ast.start, end: ast.end, level: state.level}
            state.inExpression = prevInExpression
            --state.level

    return

TRF_DICT =
    spRepeat: (str, options, transformations, start, end, state, node)->
        if node.value.type is 'JSXExpressionContainer' and node.value.expression.type is 'NumericLiteral'
            value = node.value.expression.value
            left = """
                (function() {
                    var arr = new Array(#{value});
                    for (var index = 0; index < #{value}; index++) {
                        arr[index] = ("""

            right = """);
                }
                return arr;
            }).call(this)"""
        else
            value = node.value.value
            ast = parse(value).program

            if ast.body.length isnt 1 or
            'ExpressionStatement' isnt ast.body[0].type
                throw new Error "invalid spRepeat value at #{node.start}, #{node.end}. expecting an ExpressionStatement"

            if 'BinaryExpression' isnt ast.body[0].expression.type or
            'in' isnt ast.body[0].expression.operator
                throw new Error "invalid spRepeat value at #{node.start}, #{node.end}. expecting '(value, key) in obj' or 'element in elements'"

            {start: _start, end: _end} = ast.body[0].expression.left
            args = value.substring _start, _end
            {start: _start, end: _end} = ast.body[0].expression.right
            obj = value.substring _start, _end

            left = options.map + "(#{obj}, function(#{args}) {return ("
            right = ")}.bind(this))"

        if ~state.attributes.indexOf('spShow')
            left = left.substring(0, left.length - 1)
            right = right.substring(1)

        if not state.inExpression and state.level > 1
            left = '{ ' + left
            right = right + ' }'

        prefix = str.substring(0, start)
        suffix = str.substring(end)

        toRepeat = str.substring(start, node.start) + str.substring(node.end, end)
        res = prefix + left + toRepeat + right + suffix

        # attribute has been removed
        leftoffset = left.length
        middle = node.start
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length

        shiftTransform ['spRepeat', str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state

        res

    spShow: (str, options, transformations, start, end, state, node)->
        condition = str.substring node.value.expression.start, node.value.expression.end
        toDisplay = str.substring(start, node.start) + str.substring(node.end, end)

        left = "(#{condition} ? "
        right = " : void 0)"

        if not state.inExpression and state.level > 1 and state.attributes.indexOf('spRepeat') is -1
            left = '{ ' + left
            right = right + ' }'

        res = str.substring(0, start) + left + toDisplay + right + str.substring(end)

        # attribute has been removed
        leftoffset = left.length
        rightoffset = leftoffset - node.end + node.start
        offset = rightoffset + right.length
        middle = node.start

        shiftTransform ['spShow', str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state

        res

    spModel: (str, options, transformations, start, end, state, expr)->
        value = str.substring(start, end)
        ast = parse(value).program

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

        replace = "[#{object}, '#{property.replace(/'/g, "\\'")}']"
        return strReplace 'spModel', str, replace, start, end, transformations, state

    mdlOpen: (str, options, transformations, start, end, state)->
        if options.mdl
            replace = "#{options.mdl} tagName=\"#{str.substring(start, end)}\""
            return strReplace 'mdlOpen', str, replace, start, end, transformations, state

        return str

    mdlClose: (str, options, transformations, start, end, state)->
        if options.mdl
            replace = "#{options.mdl}"
            return strReplace 'mdlClose', str, replace, start, end, transformations, state

        return str

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

        TRF_DICT['sp' + type] = (str, options, transformations, start, end)->
            str.substring(0, start) + 'on' + type + str.substring(end)

        TRF_DICT['sp' + type + 'Value'] = (str, options, transformations, start, end, state)->
            left = "{ (function(event, domID, originalEvent) "
            right = ").bind(this) }"
            res = str.substring(0, start) + left + str.substring(start, end) + right + str.substring(end)

            offset = left.length + right.length
            leftoffset = left.length
            middle = null
            rightoffset = null

            shiftTransform ['sp' + type, str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state

            res
        return


    for evt in delegateEvents
        delegate evt

    return

parse = (str, options)->
    babylon.parse str, _.extend {plugins: ['jsx', 'flow']}, options

transform = (str, options)->
    options = _.extend {
        map: '_.map',
        # mdl: 'Mdl'
    }, options

    ast = parse str, options
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
        trf.splice 0, 0, str, options, transformations
        if hasOwn.call TRF_DICT, name
            str = TRF_DICT[name].apply null, trf
    str

module.exports = transform
