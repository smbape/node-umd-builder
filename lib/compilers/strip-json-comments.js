/* eslint-disable no-empty-function */
var StripJsonCommentsCompiler, stripJsonComments;

stripJsonComments = require("strip-json-comments");

StripJsonCommentsCompiler = (function() {
  function StripJsonCommentsCompiler() {}

  StripJsonCommentsCompiler.prototype.brunchPlugin = true;

  StripJsonCommentsCompiler.prototype.type = "javascript";

  StripJsonCommentsCompiler.prototype.completer = true;

  StripJsonCommentsCompiler.prototype.compile = function(params, next) {
    var data, map, path;
    data = params.data, path = params.path, map = params.map;
    params.data = data;
    next(null, {
      data: stripJsonComments(data),
      path: path,
      map: map
    });
  };

  return StripJsonCommentsCompiler;

})();

module.exports = StripJsonCommentsCompiler;
