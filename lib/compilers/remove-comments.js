/* eslint-disable no-empty-function */
var RemoveCommentsCompiler, removeComments;

removeComments = require("../../utils/remove-comments");

RemoveCommentsCompiler = (function() {
  function RemoveCommentsCompiler() {}

  RemoveCommentsCompiler.prototype.brunchPlugin = true;

  RemoveCommentsCompiler.prototype.type = "javascript";

  RemoveCommentsCompiler.prototype.completer = true;

  RemoveCommentsCompiler.prototype.compile = function(params, next) {
    var data, path;
    data = params.data, path = params.path;
    if (!(data = removeComments(data))) {
      console.log(path);
    }
    params.data = data;
    next(null, params);
  };

  return RemoveCommentsCompiler;

})();

module.exports = RemoveCommentsCompiler;
