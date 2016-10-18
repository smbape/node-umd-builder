var globMatcher, matcher;

globMatcher = (function() {
  var map, mnsep, mstar, nsep, sep, specialPattern, star;
  sep = '[\\/\\\\]';
  nsep = '[^\\/\\\\]';
  mnsep = nsep + '*';
  star = '\\*';
  mstar = '\\*{2,}';
  specialPattern = new RegExp('(?:' + ['(' + sep + mstar + '$)', '(' + sep + mstar + sep + ')', '(' + sep + mstar + ')', '(' + mstar + sep + ')', '(' + mstar + ')', '(' + sep + star + sep + ')', '(' + [sep + star + '$', star + sep + '$', star].join('|') + ')', '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])'].join('|') + ')', 'g');
  map = {
    '|': '|',
    '$': '$',
    '/': sep,
    '\\': sep
  };
  return function(str) {
    if (Array.isArray(str)) {
      str = str.join('|');
    } else if ('string' !== typeof str) {
      return '';
    }
    return str.replace(specialPattern, function(match) {
      if (arguments[1] || arguments[5]) {
        return '.*?';
      }
      if (arguments[2]) {
        return sep + '(?:.*?' + sep + '|)';
      }
      if (arguments[3]) {
        return sep + '.*?';
      }
      if (arguments[4]) {
        return '.*?' + sep;
      }
      if (arguments[6]) {
        return sep + '(?:' + mnsep + sep + '|)';
      }
      if (arguments[7]) {
        return mnsep;
      }
      return map[match] || '\\' + match;
    });
  };
})();

module.exports = matcher = function(include, exclude) {
  include = globMatcher(include);
  exclude = globMatcher(exclude);
  if (include.length === 0 && exclude.length === 0) {
    return /(?!^)^/;
  }
  if (exclude.length === 0) {
    return new RegExp('^(?:' + include + ')');
  }
  if (include.length === 0) {
    return new RegExp('^(?!' + exclude + ')');
  }
  return new RegExp('^(?!' + exclude + ')(?:' + include + ')');
};
