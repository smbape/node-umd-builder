var RemoveCommentsCompiler, removeComments, sysPath;

sysPath = require('path');

removeComments = require('../../utils/remove-comments');

module.exports = RemoveCommentsCompiler = (function() {
  function RemoveCommentsCompiler() {}

  RemoveCommentsCompiler.prototype.brunchPlugin = true;

  RemoveCommentsCompiler.prototype.type = 'javascript';

  RemoveCommentsCompiler.prototype.completer = true;

  RemoveCommentsCompiler.prototype.compile = function(params, next) {
    var data, map, path;
    data = params.data, path = params.path, map = params.map;
    if (!(data = removeComments(data))) {
      console.log(path);
    }
    params.data = data;
    next(null, params);
  };

  return RemoveCommentsCompiler;

})();
