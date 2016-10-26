/* jshint node: true */
'use strict';

var vm = require('vm');

exports.parse = parse;
exports.vmParse = vmParse;

function vmParse(str) {

}

// http://www.regular-expressions.info/characters.html#special
var specialReg = new RegExp('([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g');

function escapeRegExp(str) {
    return str.replace(specialReg, '\\$1');
}

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /^\s*(_?)(.+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

function forEach(arr, cb) {
    return Array.prototype.forEach.call(arr, cb);
}

function annotate(fn) {
    var $inject, argDecl, fnText;
    if ('string' !== typeof fn) {
        return;
    }
    $inject = [];
    fnText = fn.replace(STRIP_COMMENTS, '');
    argDecl = fnText.match(FN_ARGS);
    forEach(argDecl[1].split(FN_ARG_SPLIT), function(arg) {
        arg.replace(FN_ARG, function(all, underscore, name) {
            $inject.push(name);
        });
    });
    return $inject;
}

exports.NG_PREFIX = 'ng';
var NG_FNS = ['usable', 'run', 'config', 'module', 'factory', 'filter', 'directive', 'controller', 'service', 'value', 'constant', 'decorator', 'provider'].map(function(element) {
    return exports.NG_PREFIX + element;
});
exports.NG_FNS = NG_FNS;

var OTHER_FNS = ['factory', 'freact'];
exports.OTHER_FNS = OTHER_FNS;

var ALL_FNS = '\\b(' + OTHER_FNS.concat(NG_FNS).join('|') + ')\\b';
// var ALL_FNS = '\\b(' + ['factory'].join('|') + ')\\b';
exports.ALL_FNS = ALL_FNS;
var FN_ARGS_REG = /(\s*[^\(]*\(\s*[^\)]*\))/;
var ALL_FNS_REG = new RegExp("(?:" + ALL_FNS + "\\s*=\\s*(?:function" + FN_ARGS_REG.source + ")?|function\\s+" + ALL_FNS + FN_ARGS_REG.source + ")");

var SYMBOLS = {
    LOCALS: /\/\*\s*locals\s*=\s*([^*]+)\s*\*\//,
    ALL_FNS_REG: ALL_FNS_REG,
    LINE_COMMENT: '//',
    BLOCK_COMMENT_START: '/*',
    BLOCK_COMMENT_END: '*/',
    REGEXP_QUOTE_BEGIN: /([\,\{\}\;\=\(\+\-\!\&\|\:])[^\S\n]*\/(?!\/)/,
    REGEXP_QUOTE_END: '/',
    SINGLE_QUOTE: "'",
    DOUBLE_QUOTE: '"',
    ESCAPED_QUOTE_OR_NEW_LINE: /\\(?:["'\/\\]|\r?\n)/,
    NEW_LINE: /\r?\n/,
    CURLY_BEGIN: '{',
    CURLY_END: '}',
    PAREN_BEGIN: '(',
    PAREN_END: ')',
    NON_NEW_LINE: /./
};

var tokenizer = createTokenizer([
    SYMBOLS.LINE_COMMENT,
    SYMBOLS.LOCALS,
    SYMBOLS.BLOCK_COMMENT_START,
    SYMBOLS.BLOCK_COMMENT_END,
    SYMBOLS.CURLY_BEGIN,
    SYMBOLS.CURLY_END,
    SYMBOLS.PAREN_BEGIN,
    SYMBOLS.PAREN_END,
    SYMBOLS.ALL_FNS_REG,
    SYMBOLS.ESCAPED_QUOTE_OR_NEW_LINE,
    SYMBOLS.SINGLE_QUOTE,
    SYMBOLS.DOUBLE_QUOTE,
    SYMBOLS.REGEXP_QUOTE_BEGIN,
    SYMBOLS.REGEXP_QUOTE_END,
    SYMBOLS.NEW_LINE
]);
// console.log(tokenizer);

function createTokenizer(symbols) {
    var tokenizer = [];
    for (var i = 0, len = symbols.length; i < len; i++) {
        if (symbols[i] instanceof RegExp) {
            tokenizer.push(symbols[i].source);
        } else {
            tokenizer.push(escapeRegExp(symbols[i]));
        }
    }

    return new RegExp(tokenizer.join('|'), 'mg');
}

function parse(str) {
    return _parse(str, new RegExp(tokenizer));
}

function _parse(str, tokenizer) {
    var STATES = {
        initial: 0,
        line_commenting: 1,
        block_commenting: 2,
        single_quoting: 3,
        double_quoting: 4,
        regexp_quoting: 5,
        stop: 6
    };

    var scope = 0,
        lastIndex = 0,
        line = 1,
        col = 0,
        pos, matcher, state, locals, name, args, index, head, body, declaration,
        quoting_start;

    while (state !== STATES.stop && (matcher = tokenizer.exec(str))) {
        lastIndex = tokenizer.lastIndex;
        index = lastIndex - matcher[0].length;
        processMactch.apply(str, matcher);
    }

    if (state === STATES.stop) {
        head = str.slice(0, pos[0]);
        declaration = str.slice(pos[0], pos[1]);
        body = str.slice(pos[2]);
    }

    return [locals, name, args, head, declaration, body];

    function processMactch(match, _locals, name1, args1, name2, args2, regexp_quote) {
        // console.log(scope, state, arguments);

        switch (match) {
            case SYMBOLS.LINE_COMMENT:
                switch (state) {
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.regexp_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        state = STATES.line_commenting;
                        return;
                }
                /* falls through */
            case SYMBOLS.BLOCK_COMMENT_START:
                switch (state) {
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    case STATES.regexp_quoting:
                        state = STATES.initial;
                        return;
                    default:
                        state = STATES.block_commenting;
                        return;
                }
                /* falls through */
            case SYMBOLS.BLOCK_COMMENT_END:
                switch (state) {
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.line_commenting:
                        return;
                    case STATES.regexp_quoting:
                        state = STATES.initial;
                        return;
                    case STATES.block_commenting:
                        state = STATES.initial;
                        return;
                    default:
                        return;
                }
                /* falls through */
            case SYMBOLS.SINGLE_QUOTE:
                switch (state) {
                    case STATES.single_quoting:
                        state = STATES.initial;
                        /* falls through */
                    case STATES.double_quoting:
                    case STATES.regexp_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        // console.log('single_quoting');
                        state = STATES.single_quoting;
                        quoting_start = 'line ' + line + ' col ' + (index - col + 1);
                        return;
                }
                /* falls through */
            case SYMBOLS.DOUBLE_QUOTE:
                switch (state) {
                    case STATES.double_quoting:
                        state = STATES.initial;
                        return;
                    case STATES.single_quoting:
                    case STATES.regexp_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        // console.log('double_quoting');
                        state = STATES.double_quoting;
                        quoting_start = 'line ' + line + ' col ' + (index - col + 1);
                        return;
                }
                /* falls through */
            case SYMBOLS.CURLY_BEGIN:
            case SYMBOLS.PAREN_BEGIN:
                switch (state) {
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.regexp_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        ++scope;
                        return;
                }
                /* falls through */
            case SYMBOLS.CURLY_END:
            case SYMBOLS.PAREN_END:
                switch (state) {
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.regexp_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        --scope;
                        return;
                }
                /* falls through */
            case SYMBOLS.REGEXP_QUOTE_END:
                // console.log('regexp_quoting', col, index, [str.slice(col, index)], state, arguments);
                switch (state) {
                    case STATES.regexp_quoting:
                        state = STATES.initial;
                        return;
                    case STATES.single_quoting:
                    case STATES.double_quoting:
                    case STATES.line_commenting:
                    case STATES.block_commenting:
                        return;
                    default:
                        // console.log('regexp_quoting', {
                        //     col: col,
                        //     index: index,
                        //     str: str.slice(col, index),
                        //     state: state,
                        //     arguments: arguments
                        // });
                        if (
                            /^\s*$/.test(str.slice(col, index)) /* begining of line */ ||
                            /[\,\{\}\;\=\(\+\-\!\&\|\:]\s*$/m.test(str.slice(col, index)) ||
                            'string' === typeof regexp_quote) {
                            // console.log('regexp_quoting');
                            state = STATES.regexp_quoting;
                            quoting_start = 'line ' + line + ' col ' + (index - col + 1);
                        }
                        return;
                }
                /* falls through */
            default:
                if (!SYMBOLS.ESCAPED_QUOTE_OR_NEW_LINE.test(match) && SYMBOLS.NEW_LINE.test(match)) {
                    switch (state) {
                        case STATES.single_quoting:
                        case STATES.double_quoting:
                        case STATES.regexp_quoting:
                            var msg = 'quoting ' + state + ' started at ' + quoting_start + ' not ended and found a new line at ' + line + ' col ' + (index - col + 1);
                            throw new Error(msg);
                        case STATES.line_commenting:
                            state = STATES.initial;
                            /* falls through */
                        default:
                            line++;
                            col = lastIndex;
                            return match;
                    }
                } else if (!_locals && 'string' === typeof regexp_quote) {
                    switch (state) {
                        case STATES.regexp_quoting:
                            state = STATES.initial;
                            return;
                        case STATES.single_quoting:
                        case STATES.double_quoting:
                        case STATES.block_commenting:
                        case STATES.line_commenting:
                            return;
                        default:
                            // console.log('regexp_quoting', index);
                            state = STATES.regexp_quoting;
                            quoting_start = 'line ' + line + ' col ' + (index - col + 1);
                            return;
                    }
                } else if (scope === 0) {
                    switch (state) {
                        case STATES.single_quoting:
                        case STATES.double_quoting:
                        case STATES.regexp_quoting:
                        case STATES.line_commenting:
                        case STATES.block_commenting:
                            return;
                    }

                    if (_locals) {
                        locals = _locals.trim();
                    } else if (name1 || name2) {
                        var fnText = str.slice(index, lastIndex);
                        name = name1 || name2;
                        if (args1 || args2) {
                            args = (args1 || args2).trim();
                            var declarationIndex = fnText.indexOf(args);
                            var argIndex = fnText.indexOf('(', declarationIndex);
                            pos = [index, index + argIndex + 1, index + declarationIndex + args.length - 1, lastIndex];
                            args = annotate("function " + args);
                        } else {
                            args = [];
                            pos = [index, index, index, lastIndex];
                        }
                        state = STATES.stop;
                    }
                }
        }
    }
}