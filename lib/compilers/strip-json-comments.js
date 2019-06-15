var StripJsonCommentsCompiler, stripJsonComments;

stripJsonComments = require("strip-json-comments");

StripJsonCommentsCompiler = function() {
  class StripJsonCommentsCompiler {
    // eslint-disable-next-line class-methods-use-this
    compile(params, next) {
      var data, map, path;
      ({data, path, map} = params);
      params.data = data;
      next(null, {
        data: stripJsonComments(data),
        path,
        map
      });
    }

  }

  StripJsonCommentsCompiler.prototype.brunchPlugin = true;

  StripJsonCommentsCompiler.prototype.type = "javascript";

  StripJsonCommentsCompiler.prototype.completer = true;

  return StripJsonCommentsCompiler;

}.call(this);

module.exports = StripJsonCommentsCompiler;
