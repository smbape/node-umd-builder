var EXPRESSION_REG, TRF_DICT, _, babylon, cid, escodegen, hasAttriute, hasOwn, isDedugEnabled, lookupTransforms, parse, shiftRange, shiftTransform, strReplace, transform,
  hasProp = {}.hasOwnProperty;

babylon = require('babylon');

escodegen = require('escodegen');

_ = require('lodash');

hasOwn = {}.hasOwnProperty;

isDedugEnabled = false;

shiftRange = function(prevStart, prevEnd, start, end, offset, leftoffset, middle, rightoffset) {
  if (prevEnd > end) {
    prevEnd += offset;
    if (prevStart >= end) {
      prevStart += offset;
    }
  } else if (prevStart >= start) {
    if (middle) {
      if (prevStart > middle) {
        prevStart += rightoffset;
        prevEnd += rightoffset;
      } else if (prevEnd <= middle) {
        prevStart += leftoffset;
        prevEnd += leftoffset;
      } else {
        prevStart += leftoffset;
        prevEnd += rightoffset;
      }
    } else {
      prevStart += leftoffset;
      prevEnd += leftoffset;
    }
  }
  return [prevStart, prevEnd];
};

shiftTransform = function(arg, transformations, start, end, offset, leftoffset, middle, rightoffset, state) {
  var i, j, len, len1, name, newEnd, newStart, node, ref, ref1, ref2, ref3, ref4, ref5, ref6, res, str, transformation;
  name = arg[0], str = arg[1], res = arg[2];
  if (isDedugEnabled) {
    console.log({
      name: name,
      start: start,
      end: end,
      level: state.level,
      inExpression: state.inExpression,
      before: str,
      offset: offset,
      leftoffset: leftoffset,
      rightoffset: rightoffset,
      trf: transformations[0] ? {
        name: transformations[0][0],
        start: transformations[0][1],
        end: transformations[0][2],
        snode: (ref = transformations[0][4]) != null ? ref.start : void 0,
        enode: (ref1 = transformations[0][4]) != null ? ref1.end : void 0
      } : null
    });
  }
  ref2 = state.flattern;
  for (i = 0, len = ref2.length; i < len; i++) {
    node = ref2[i];
    ref3 = shiftRange(node.start, node.end, start, end, offset, leftoffset, middle, rightoffset), newStart = ref3[0], newEnd = ref3[1];
    node.start = newStart;
    node.end = newEnd;
  }
  for (j = 0, len1 = transformations.length; j < len1; j++) {
    transformation = transformations[j];
    ref4 = shiftRange(transformation[1], transformation[2], start, end, offset, leftoffset, middle, rightoffset), newStart = ref4[0], newEnd = ref4[1];
    transformation[1] = newStart;
    transformation[2] = newEnd;
  }
  if (isDedugEnabled) {
    console.log({
      name: name,
      start: start,
      end: end,
      level: state.level,
      inExpression: state.inExpression,
      after: res,
      offset: offset,
      leftoffset: leftoffset,
      rightoffset: rightoffset,
      trf: transformations[0] ? {
        name: transformations[0][0],
        start: transformations[0][1],
        end: transformations[0][2],
        snode: (ref5 = transformations[0][4]) != null ? ref5.start : void 0,
        enode: (ref6 = transformations[0][4]) != null ? ref6.end : void 0
      } : null
    });
  }
};

strReplace = function(name, str, replace, start, end, transformations, state) {
  var leftoffset, middle, offset, res, rightoffset;
  res = str.substring(0, start) + replace + str.substring(end);
  offset = replace.length - end + start;
  leftoffset = offset;
  middle = null;
  rightoffset = null;
  shiftTransform([name, str, res], transformations, start, end, offset, leftoffset, null, null, state);
  return res;
};

hasAttriute = function(name, attributes) {
  return attributes.some(function(node) {
    return node.name.name === name;
  });
};

EXPRESSION_REG = /Expression/;

cid = 0;

lookupTransforms = function(ast, transformations, state, astStack, stateStack) {
  var attribute, attributes, closingElement, currState, end, expression, i, iast, inExpression, len, middle, prevInExpression, prop, ref, start, value;
  if (state == null) {
    state = {
      level: 0,
      flattern: []
    };
  }
  if (astStack == null) {
    astStack = [];
  }
  if (stateStack == null) {
    stateStack = [];
  }
  delete state.attribute;
  if (Array.isArray(ast)) {
    astStack.push(ast);
    stateStack.push(_.clone(state));
    for (i = 0, len = ast.length; i < len; i++) {
      iast = ast[i];
      lookupTransforms(iast, transformations, state, astStack, stateStack);
    }
    stateStack.pop();
    astStack.pop();
  } else if (_.isObject(ast)) {
    if (hasOwn.call(ast, 'type')) {
      ast.cid = ++cid;
      state.flattern.push(ast);
      switch (ast.type) {
        case 'JSXAttribute':
          if (isDedugEnabled) {
            console.log('start', {
              type: ast.type,
              start: ast.start,
              end: ast.end,
              level: state.level
            });
          }
          inExpression = stateStack[stateStack.length - 4].inExpression;
          attribute = state.attribute = ast.name.name;
          currState = _.defaults({
            inExpression: inExpression
          }, state);
          if (ast.name.type === 'JSXIdentifier') {
            switch (attribute) {
              case 'spRepeat':
                if (ast.value.type === 'StringLiteral' || (ast.value.type === 'JSXExpressionContainer' && ast.value.expression.type === 'NumericLiteral')) {
                  expression = currState.expression = astStack[astStack.length - 3];
                  attributes = currState.attributes = astStack[astStack.length - 1].map(function(node) {
                    return node.name.name;
                  });
                  transformations.push([attribute, expression.start, expression.end, currState, ast]);
                } else {
                  console.log(ast.value.expression);
                  throw new Error(attribute + " attribute at " + ast.start + ", " + ast.end + " expects a string literal as value");
                }
                break;
              case 'spShow':
                if (ast.value.type === 'JSXExpressionContainer') {
                  expression = currState.expression = astStack[astStack.length - 3];
                  attributes = currState.attributes = astStack[astStack.length - 1].map(function(node) {
                    return node.name.name;
                  });
                  transformations.push([attribute, expression.start, expression.end, currState, ast]);
                } else {
                  throw new Error(attribute + " attribute at " + ast.start + ", " + ast.end + " expects a javascript expression");
                }
                break;
              case 'spModel':
                if (ast.value.type === 'JSXExpressionContainer') {
                  transformations.push([attribute, ast.value.expression.start, ast.value.expression.end, currState, ast.value.expression]);
                } else if (ast.value.type !== 'StringLiteral') {
                  throw new Error(attribute + " attribute at " + ast.start + ", " + ast.end + " expects a string literal or a javascript expression");
                }
                break;
              default:
                if (hasOwn.call(TRF_DICT, attribute)) {
                  if (ast.value.type === 'JSXExpressionContainer') {
                    start = ast.name.start;
                    middle = ast.name.end;
                    end = ast.value.end;
                    transformations.push([attribute, ast.name.start, ast.name.end, currState]);
                    transformations.push([attribute + 'Value', ast.value.start, ast.value.end, currState]);
                  } else {
                    throw new Error(attribute + " attribute at " + ast.start + ", " + ast.end + " expects a javascript expression");
                  }
                }
            }
          }
          break;
        case 'JSXElement':
          if (isDedugEnabled) {
            console.log('start', {
              type: ast.type,
              start: ast.start,
              end: ast.end,
              level: state.level
            });
          }
          prevInExpression = state.inExpression;
          inExpression = state.inExpression = false;
          ++state.level;
          break;
        case 'JSXOpeningElement':
          if (ast.attributes && ((ref = ast.name) != null ? ref.name : void 0) && /[a-z]/.test(ast.name.name[0])) {
            attributes = ast.attributes.filter(function(node) {
              var ref1;
              return ((ref1 = node.name) != null ? ref1.name : void 0) === 'className';
            });
            if (attributes.length) {
              value = attributes[attributes.length - 1].value;
              if (value.type === 'StringLiteral' && /(?:^|\s)mdl-/.test(value.value)) {
                transformations.push(['mdlOpen', ast.name.start, ast.name.end, state]);
                if (!ast.selfClosing) {
                  closingElement = astStack[astStack.length - 1].closingElement.name;
                  transformations.push(['mdlClose', closingElement.start, closingElement.end, state]);
                }
              }
            }
          }
          break;
        default:
          if (EXPRESSION_REG.test(ast.type)) {
            if (isDedugEnabled) {
              console.log('start', {
                type: ast.type,
                start: ast.start,
                end: ast.end,
                level: state.level
              });
            }
            prevInExpression = state.inExpression;
            inExpression = state.inExpression = true;
          }
      }
    }
    astStack.push(ast);
    stateStack.push(_.clone(state));
    for (prop in ast) {
      if (!hasProp.call(ast, prop)) continue;
      lookupTransforms(ast[prop], transformations, state, astStack, stateStack);
    }
    stateStack.pop();
    astStack.pop();
    if (inExpression) {
      if (isDedugEnabled) {
        console.log('end', {
          type: ast.type,
          start: ast.start,
          end: ast.end,
          level: state.level
        });
      }
      state.inExpression = prevInExpression;
    } else if (ast.type === 'JSXElement') {
      if (isDedugEnabled) {
        console.log('end', {
          type: ast.type,
          start: ast.start,
          end: ast.end,
          level: state.level
        });
      }
      state.inExpression = prevInExpression;
      --state.level;
    }
  }
};

TRF_DICT = {
  spRepeat: function(str, options, transformations, start, end, state, node) {
    var _end, _start, args, ast, left, leftoffset, middle, obj, offset, prefix, ref, ref1, res, right, rightoffset, suffix, toRepeat, value;
    if (node.value.type === 'JSXExpressionContainer' && node.value.expression.type === 'NumericLiteral') {
      value = node.value.expression.value;
      left = "(function() {\n    var arr = new Array(" + value + ");\n    for (var index = 0; index < " + value + "; index++) {\n        arr[index] = (";
      right = ");\n    }\n    return arr;\n}).call(this)";
    } else {
      value = node.value.value;
      ast = parse(value).program;
      if (ast.body.length !== 1 || 'ExpressionStatement' !== ast.body[0].type) {
        throw new Error("invalid spRepeat value at " + node.start + ", " + node.end + ". expecting an ExpressionStatement");
      }
      if ('BinaryExpression' !== ast.body[0].expression.type || 'in' !== ast.body[0].expression.operator) {
        throw new Error("invalid spRepeat value at " + node.start + ", " + node.end + ". expecting '(value, key) in obj' or 'element in elements'");
      }
      ref = ast.body[0].expression.left, _start = ref.start, _end = ref.end;
      args = value.substring(_start, _end);
      ref1 = ast.body[0].expression.right, _start = ref1.start, _end = ref1.end;
      obj = value.substring(_start, _end);
      left = options.map + ("(" + obj + ", function(" + args + ") {return (");
      right = ")}.bind(this))";
    }
    if (~state.attributes.indexOf('spShow')) {
      left = left.substring(0, left.length - 1);
      right = right.substring(1);
    }
    if (!state.inExpression && state.level > 1) {
      left = '{ ' + left;
      right = right + ' }';
    }
    prefix = str.substring(0, start);
    suffix = str.substring(end);
    toRepeat = str.substring(start, node.start) + str.substring(node.end, end);
    res = prefix + left + toRepeat + right + suffix;
    leftoffset = left.length;
    middle = node.start;
    rightoffset = leftoffset - node.end + node.start;
    offset = rightoffset + right.length;
    shiftTransform(['spRepeat', str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state);
    return res;
  },
  spShow: function(str, options, transformations, start, end, state, node) {
    var condition, left, leftoffset, middle, offset, res, right, rightoffset, toDisplay;
    condition = str.substring(node.value.expression.start, node.value.expression.end);
    toDisplay = str.substring(start, node.start) + str.substring(node.end, end);
    left = "(" + condition + " ? ";
    right = " : void 0)";
    if (!state.inExpression && state.level > 1 && state.attributes.indexOf('spRepeat') === -1) {
      left = '{ ' + left;
      right = right + ' }';
    }
    res = str.substring(0, start) + left + toDisplay + right + str.substring(end);
    leftoffset = left.length;
    rightoffset = leftoffset - node.end + node.start;
    offset = rightoffset + right.length;
    middle = node.start;
    shiftTransform(['spShow', str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state);
    return res;
  },
  spModel: function(str, options, transformations, start, end, state, expr) {
    var ast, object, property, ref, replace, value;
    value = str.substring(start, end);
    ast = parse(value).program;
    if (ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement') {
      switch (ast.body[0].expression.type) {
        case 'MemberExpression':
          ref = ast.body[0].expression, object = ref.object, property = ref.property;
          property.end -= property.start;
          property.start = 0;
          object = escodegen.generate(object);
          property = escodegen.generate(property);
          break;
        case 'ArrayExpression':
          return str;
        default:
          throw new Error("spModel attribute must be an ExpressionStatement at (" + expr.start + ":" + expr.end + ") with a MemberExpression or an ArrayExpression");
      }
    } else {
      throw new Error("spModel attribute at (" + expr.start + ":" + expr.end + ") must be an ExpressionStatement");
    }
    replace = "[" + object + ", '" + (property.replace(/'/g, "\\'")) + "']";
    return strReplace('spModel', str, replace, start, end, transformations, state);
  },
  mdlOpen: function(str, options, transformations, start, end, state) {
    var replace;
    if (options.mdl) {
      replace = options.mdl + " tagName=\"" + (str.substring(start, end)) + "\"";
      return strReplace('mdlOpen', str, replace, start, end, transformations, state);
    }
    return str;
  },
  mdlClose: function(str, options, transformations, start, end, state) {
    var replace;
    if (options.mdl) {
      replace = "" + options.mdl;
      return strReplace('mdlClose', str, replace, start, end, transformations, state);
    }
    return str;
  }
};

(function() {
  var delegate, delegateEvents, evt, i, len;
  delegateEvents = ['blur', 'change', 'click', 'drag', 'drop', 'focus', 'input', 'load', 'mouseenter', 'mouseleave', 'mousemove', 'propertychange', 'reset', 'scroll', 'submit', 'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'encrypted', 'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play', 'playing', 'progress', 'ratechange', 'seeked', 'seeking', 'stalled', 'suspend', 'timeupdate', 'volumechange', 'waiting'];
  delegate = function(type) {
    type = type[0].toUpperCase() + type.substring(1);
    TRF_DICT['sp' + type] = function(str, options, transformations, start, end) {
      return str.substring(0, start) + 'on' + type + str.substring(end);
    };
    TRF_DICT['sp' + type + 'Value'] = function(str, options, transformations, start, end, state) {
      var left, leftoffset, middle, offset, res, right, rightoffset;
      left = "{ (function(event, domID, originalEvent) ";
      right = ").bind(this) }";
      res = str.substring(0, start) + left + str.substring(start, end) + right + str.substring(end);
      offset = left.length + right.length;
      leftoffset = left.length;
      middle = null;
      rightoffset = null;
      shiftTransform(['sp' + type, str, res], transformations, start, end, offset, leftoffset, middle, rightoffset, state);
      return res;
    };
  };
  for (i = 0, len = delegateEvents.length; i < len; i++) {
    evt = delegateEvents[i];
    delegate(evt);
  }
})();

parse = function(str, options) {
  return babylon.parse(str, _.extend({
    plugins: ['jsx', 'flow']
  }, options));
};

transform = function(str, options) {
  var _trf, ast, i, len, name, priorities, transformations, trf;
  options = _.extend({
    map: '_.map'
  }, options);
  ast = parse(str, options);
  transformations = [];
  lookupTransforms(ast, transformations);
  priorities = {
    spShow: [],
    spRepeat: []
  };
  _trf = [];
  for (i = 0, len = transformations.length; i < len; i++) {
    trf = transformations[i];
    switch (trf[0]) {
      case 'spShow':
        priorities.spShow.push(trf);
        break;
      case 'spRepeat':
        priorities.spRepeat.push(trf);
        break;
      default:
        _trf.push(trf);
    }
  }
  transformations = _trf.concat(priorities.spShow, priorities.spRepeat);
  while (trf = transformations.pop()) {
    name = trf.shift();
    trf.splice(0, 0, str, options, transformations);
    if (hasOwn.call(TRF_DICT, name)) {
      str = TRF_DICT[name].apply(null, trf);
    }
  }
  return str;
};

module.exports = transform;
