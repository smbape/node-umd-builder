vm = require 'vm'

getDefineLocation = (stack, depth = 0)->
    if depth < 0
        return

    index = stack.indexOf '\n'
    index = stack.indexOf '\n', index + 1

    while index isnt -1 and depth-- isnt 0
        index = stack.indexOf '\n', index + 1

    lastIndex = stack.indexOf '\n', index + 1

    curr = col
    _continue = true
    start = lastIndex

    end = start
    while start > index and stack[start] isnt ':'
        start--
    # console.log 'col', stack.substring(start + 1, end)
    col = parseInt stack.substring(start + 1, end)

    end = start--
    while start > index and stack[start] isnt ':'
        start--
    # console.log 'line', stack.substring(start + 1, end)
    line = parseInt stack.substring(start + 1, end)

    [line, col, index]

getIndex = (str, line, col)->
    if line is 1
        return col

    curr = 1
    index = 0
    lastIndex = -1
    while ~(index = str.indexOf '\n', index)
        # console.log "line #{curr} ends at #{index}", str.substring(lastIndex + 1, index)
        lastIndex = index
        index++
        break if line is ++curr

    return lastIndex + col

ensureAmdName = (data, name, depth = 0)->
    res = data
    data = """
    define.amd = {jQuery: true}; var depsLoader = {amd: amd}, window = {}; window.window = window;
    #{data}

    function require() {}

    function define(name, deps, callback) {
        if (arguments.length === 2) {
            anonymous = true;
            stack = (new Error()).stack;
        }
    }

    function amd(name, deps, callback, global) {
        if (arguments.length === 3) {
            anonymous = true;
            stack = (new Error()).stack;
        }
    }
    """

    sandbox = {}
    context = new vm.createContext(sandbox)

    try
        script = new vm.Script(data)
        script.runInContext(context)
    catch e
        return data

    # console.log sandbox

    if sandbox.anonymous
        stack = sandbox.stack
        [line, col, index] = getDefineLocation stack, depth

        # console.log stack.split('\n')
        # console.log line, col

        start = getIndex(res, line - 1, col)

        # console.log start

        defstart = res.indexOf '(', start

        # console.log res.substring(0, defstart + 1)

        res = res.substring(0, defstart + 1) + "'" + name + '\', ' + res.substring(defstart + 1)

    return res


module.exports = ensureAmdName