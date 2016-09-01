var builder, cache, config, globMatcher, hasOwn, log4js, logger, matcher, read, sysPath, util;

log4js = require('../log4js');

logger = log4js.getLogger('brunch-config');

util = require('util');

sysPath = require('path');

builder = require('./builder');

read = require('../utils/read-components');

hasOwn = Object.prototype.hasOwnProperty;

cache = {};

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

matcher = function(include, exclude) {
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

exports.logger = logger;

exports.matcher = matcher;

exports.isVendor = matcher(['bower_components/', 'components/', 'vendor/']);

config = exports.config = {
  npm: {
    enabled: false
  },
  compilers: [require('./compilers/amd'), require('./compilers/copy'), require('./compilers/relativecss')],
  modules: {
    nameCleaner: function(path, ext) {
      if (ext == null) {
        ext = false;
      }
      if (!config.conventions.vendor(path)) {
        path = path.replace(/^(?:app[\/\\]node_modules|bower_components|components)[\/\\](.*)$/, '$1');
      }
      path = path.replace(/[\\]/g, '/');
      if (ext) {
        return path;
      } else {
        return path.replace(/\.[^.]*$/, '');
      }
    },
    amdDestination: function(path, ext) {
      if (ext == null) {
        ext = false;
      }
      if (!config.conventions.vendor(path)) {
        path = path.replace(/^(?:app[\/\\]node_modules|bower_components|components)[\/\\](.*)$/, 'node_modules/$1');
      }
      path = path.replace(/[\\]/g, '/');
      if (ext) {
        return path;
      } else {
        return path.replace(/\.[^.]*$/, '');
      }
    },
    wrapper: function(path, data, isVendor) {
      var modulePath;
      if (isVendor) {
        logger.debug("Not wrapping '" + path + "', is vendor file");
        return data;
      } else {
        modulePath = config.modules.nameCleaner(path);
        logger.debug("commonJs wrapping for '" + path + "'");
        return "require.define({\"" + modulePath + "\": function(exports, require, module) {\n    " + data + "\n}});\n";
      }
    }
  },
  paths: {
    watched: ['app', 'vendor']
  },
  files: {
    javascripts: {
      joinTo: {
        'javascripts/app.js': matcher(['app/node_modules/']),
        'javascripts/vendor.js': matcher(['bower_components/', 'components/', 'vendor/'], ['vendor/html5shiv.js$', 'vendor/require.js$', 'vendor/modernizr-custom.js$', 'vendor/respond.src.js$'])
      }
    },
    stylesheets: {
      joinTo: {
        'stylesheets/app.css': matcher(['app/node_modules/', 'bower_components/', 'components/', 'vendor/'], ['app/node_modules/**/variables.styl$'])
      }
    },
    templates: {
      joinTo: 'javascripts/app.js'
    }
  },
  plugins: {
    amd: {
      strict: true,
      jshint: true,
      "package": false
    },
    coffeescript: {
      bare: true
    },
    jshint: {
      warnOnly: true
    },
    jst: {
      variable: 'root',
      ignore: /<%--([\s\S]+?)--%>/g,
      escape: /<%-([\s\S]+?)%>/g,
      interpolate: /<%=([\s\S]+?)%>/g,
      evaluate: /<%([\s\S]+?)%>/g,
      strict: true
    }
  },
  initialize: function(config, done) {
    read(sysPath.resolve(config.paths.root), 'bower', function(err, components) {
      var component, i, len;
      if (err) {
        throw err;
      }
      for (i = 0, len = components.length; i < len; i++) {
        component = components[i];
        cache[sysPath.join('bower_components', component.name)] = !component.umd;
      }
      done();
    });
  },
  onwatch: function(fswatcher, bwatcher) {
    builder.fswatcher = fswatcher;
    builder.bwatcher = bwatcher;
  },
  conventions: {
    ignored: [/[\\\/]\./, /[\\\/]_/, /bower.json/, /component.json/, /package.json/, /vendor[\\\/](?:node|j?ruby-.*|bundle)[\\\/]/],
    vendor: function(path) {
      var folder, m, res;
      if (hasOwn.call(cache, path)) {
        return cache[path];
      }
      res = cache[path] = exports.isVendor.test(path);
      if (!res) {
        return res;
      }
      if (m = /^bower_components[\/\\]([^\/\\]+)/.exec(path)) {
        folder = sysPath.join('bower_components', m[1]);
        if (hasOwn.call(cache, folder)) {
          return cache[path] = cache[folder];
        }
      }
      return res;
    }
  },
  overrides: {
    production: {
      conventions: {
        ignored: [/[\\\/]\./, /[\\\/]_/, /bower.json/, /component.json/, /package.json/, /vendor[\\\/](?:node|j?ruby-.*|bundle)[\\\/]/, /\btest\b/]
      }
    }
  }
};
