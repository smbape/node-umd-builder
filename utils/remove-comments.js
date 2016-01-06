'use strict';

module.exports = removeComments;

var SYMBOLS = {
    LINE_COMMENT: '//',
    BLOCK_COMMENT_START: '/*',
    BLOCK_COMMENT_END: '*/',
    DOUBLE_QUOTE: '"',
    NEW_LINE: /\r?\n/
};

function removeComments(str) {
    var quoting = false,
        lineCommenting = false,
        blockCommenting = false;
    return str.replace(/\/\/|\/\*|\*\/|"|\r?\n|./g, function(match, index, str) {
        switch (match) {
            case SYMBOLS.DOUBLE_QUOTE:
                if (lineCommenting || blockCommenting) {
                    return '';
                }
                quoting = !quoting;
                return match;
            case SYMBOLS.LINE_COMMENT:
                if (quoting) {
                    return match;
                } else if (!blockCommenting) {
                    lineCommenting = true;
                }
                return '';
            case SYMBOLS.BLOCK_COMMENT_START:
                if (quoting) {
                    return match;
                } else if (!lineCommenting) {
                    blockCommenting = true;
                }
                return '';
            case SYMBOLS.BLOCK_COMMENT_END:
                if (blockCommenting) {
                    blockCommenting = false;
                    return '';
                }
                return match;
            default:
                if (lineCommenting && SYMBOLS.NEW_LINE.test(match)) {
                    lineCommenting = false;
                } else if (quoting && SYMBOLS.NEW_LINE.test(match)) {
                    quoting = false;
                } else if (lineCommenting || blockCommenting) {
                    return '';
                }
                return match;
        }
    });
};