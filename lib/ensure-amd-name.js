var ensureAmdName, getDefineLocation, getIndex, vm;

vm = require("vm");

getDefineLocation = function(stack, depth = 0) {
  var col, end, index, lastIndex, line, start;
  if (depth < 0) {
    return [];
  }
  index = stack.indexOf("\n");
  index = stack.indexOf("\n", index + 1);
  while (index !== -1 && depth-- !== 0) {
    index = stack.indexOf("\n", index + 1);
  }
  lastIndex = stack.indexOf("\n", index + 1);
  start = lastIndex;
  end = start;
  while (start > index && stack[start] !== ":") {
    start--;
  }
  // console.log 'col', stack.slice(start + 1, end)
  col = parseInt(stack.slice(start + 1, end), 10);
  end = start--;
  while (start > index && stack[start] !== ":") {
    start--;
  }
  // console.log 'line', stack.slice(start + 1, end)
  line = parseInt(stack.slice(start + 1, end), 10);
  return [line, col, index];
};

getIndex = function(str, line, col) {
  var curr, index, lastIndex;
  if (line === 1) {
    return col;
  }
  curr = 1;
  index = 0;
  lastIndex = -1;
  while ((index = str.indexOf("\n", index)) !== -1) {
    // console.log "line #{curr} ends at #{index}", str.slice(lastIndex + 1, index)
    lastIndex = index;
    index++;
    if (line === ++curr) {
      break;
    }
  }
  return lastIndex + col;
};

ensureAmdName = function(data, name, depth = 0) {
  var col, context, defstart, line, res, sandbox, script, stack, start;
  res = data;
  data = `define.amd = {jQuery: true}; var depsLoader = {amd: amd}, window = {}; window.window = window;
${data}

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
}`;
  sandbox = {};
  context = new vm.createContext(sandbox);
  try {
    script = new vm.Script(data);
    script.runInContext(context);
  } catch (error) {
    return data;
  }
  // console.log sandbox
  if (sandbox.anonymous) {
    stack = sandbox.stack;
    [line, col] = getDefineLocation(stack, depth);
    // console.log stack.split('\n')
    // console.log line, col
    start = getIndex(res, line - 1, col);
    // console.log start
    defstart = res.indexOf("(", start);
    // console.log res.slice(0, defstart + 1)
    res = res.slice(0, defstart + 1) + "'" + name + "', " + res.slice(defstart + 1);
  }
  return res;
};

module.exports = ensureAmdName;
