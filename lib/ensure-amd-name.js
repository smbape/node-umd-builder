var ensureAmdName, getDefineLocation, getIndex, vm;

vm = require("vm");

getDefineLocation = function(stack, depth) {
  var col, end, index, lastIndex, line, start;
  if (depth == null) {
    depth = 0;
  }
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
  col = parseInt(stack.slice(start + 1, end), 10);
  end = start--;
  while (start > index && stack[start] !== ":") {
    start--;
  }
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
    lastIndex = index;
    index++;
    if (line === ++curr) {
      break;
    }
  }
  return lastIndex + col;
};

ensureAmdName = function(data, name, depth) {
  var col, context, defstart, line, ref, res, sandbox, script, stack, start;
  if (depth == null) {
    depth = 0;
  }
  res = data;
  data = "define.amd = {jQuery: true}; var depsLoader = {amd: amd}, window = {}; window.window = window;\n" + data + "\n\nfunction require() {}\n\nfunction define(name, deps, callback) {\n    if (arguments.length === 2) {\n        anonymous = true;\n        stack = (new Error()).stack;\n    }\n}\n\nfunction amd(name, deps, callback, global) {\n    if (arguments.length === 3) {\n        anonymous = true;\n        stack = (new Error()).stack;\n    }\n}";
  sandbox = {};
  context = new vm.createContext(sandbox);
  try {
    script = new vm.Script(data);
    script.runInContext(context);
  } catch (error) {
    return data;
  }
  if (sandbox.anonymous) {
    stack = sandbox.stack;
    ref = getDefineLocation(stack, depth), line = ref[0], col = ref[1];
    start = getIndex(res, line - 1, col);
    defstart = res.indexOf("(", start);
    res = res.slice(0, defstart + 1) + "'" + name + "', " + res.slice(defstart + 1);
  }
  return res;
};

module.exports = ensureAmdName;
