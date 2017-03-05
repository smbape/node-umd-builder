var builder, cache, config, hasProp, log4js, logger, matcher, moduleSources, pathCleaner, read, sysPath, util;

log4js = require('../log4js');

logger = log4js.getLogger('brunch-config');

util = require('util');

sysPath = require('path');

builder = require('./builder');

read = require('../utils/read-components');

matcher = require('./glob-matcher');

hasProp = Object.prototype.hasOwnProperty;

cache = {};

exports.logger = logger;

exports.matcher = matcher;

exports.isVendor = new RegExp(matcher(['bower_components', 'components', 'vendor']).source + /[\/\\]/.source);

moduleSources = ['app/node_modules', 'bower_components', 'components'];

pathCleaner = new RegExp(matcher(moduleSources).source + /[\/\\](.*)$/.source);

config = exports.config = {
  npm: {
    enabled: false
  },
  compilers: [require('./compilers/amd'), require('./compilers/copy'), require('./compilers/relativecss')],
  modules: {
    pathCleaner: pathCleaner,
    nameCleaner: function(path, ext) {
      if (ext == null) {
        ext = false;
      }
      if (!config.conventions.vendor(path)) {
        path = path.replace(config.modules.pathCleaner, '$1');
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
        path = path.replace(config.modules.pathCleaner, 'node_modules/$1');
      }
      path = path.replace(/[\\]/g, '/');
      if (ext) {
        return path;
      } else {
        return path.replace(/\.[^.]*$/, '');
      }
    },
    wrapper: function(moduleName, data, isVendor) {
      if (isVendor) {
        logger.debug("Not wrapping '" + moduleName + "', is vendor file");
        return data;
      } else {
        logger.debug("commonJs wrapping for '" + moduleName + "'");
        return "require.define({\"" + moduleName + "\": function(exports, require, module) {\n    " + data + "\n}});\n";
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
        'javascripts/vendor.js': exports.isVendor
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
      jshint: false,
      eslint: false,
      "package": false,
      tplOpts: {
        karma: {
          pattern: /-test\.js$/
        }
      }
    },
    coffeescript: {
      bare: true
    },
    eslint: {
      warnOnly: true
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
    ignored: [/[\\\/]\.(?![\\\/.])/, /[\\\/]_/, /(?!^|[\\\/])bower\.json/, /(?!^|[\\\/])component\.json/, /(?!^|[\\\/])package\.json/, /(?!^|[\\\/])vendor[\\\/](?:node|j?ruby-.*|bundle)[\\\/]/],
    vendor: function(path) {
      var folder, m, res;
      if (hasProp.call(cache, path)) {
        return cache[path];
      }
      res = cache[path] = exports.isVendor.test(path);
      if (!res) {
        return res;
      }
      if (m = /^bower_components[\/\\]([^\/\\]+)/.exec(path)) {
        folder = sysPath.join('bower_components', m[1]);
        if (hasProp.call(cache, folder)) {
          return cache[path] = cache[folder];
        }
      }
      return res;
    }
  },
  overrides: {
    production: {
      conventions: {
        ignored: [/[\\\/]\.(?![\\\/.])/, /[\\\/]_/, /(?!^|[\\\/])bower\.json/, /(?!^|[\\\/])component\.json/, /(?!^|[\\\/])package\.json/, /(?!^|[\\\/])vendor[\\\/](?:node|j?ruby-.*|bundle)[\\\/]/, /\btest\b/]
      }
    }
  }
};
