var anymatch, builder, cache, config, hasProp, joinToVendor, log4js, logger, matcher, moduleSources, pathCleaner, read, sysPath;

log4js = require("../log4js");

logger = log4js.getLogger("brunch-config");

// util = require 'util'
sysPath = require("path");

builder = require("./builder");

anymatch = require("anymatch");

read = require("../utils/read-components");

matcher = require("./glob-matcher");

hasProp = Object.prototype.hasOwnProperty;

cache = {};

exports.logger = logger;

exports.matcher = matcher;

joinToVendor = new RegExp(matcher(["bower_components", "components", "vendor", "app/assets/vendor"]).source + /[\/\\]/.source);

moduleSources = ["app/node_modules", "bower_components", "components"];

pathCleaner = new RegExp(matcher(moduleSources).source + /[\/\\](.*)$/.source);

// https://github.com/brunch/brunch/blob/2.7.4/docs/config.md
config = exports.config = {
  // npm.enabled = true makes any folder named 'node_modules' in app to be treated as an npm package
  // .i.e expecting a package.json
  npm: {
    enabled: false
  },
  compilers: [
    require("./compilers/amd"), // Mandatory. Transform files with a top level factory or freact function in umd modules
    require("./compilers/copy"), // Recommended. copy all watched files that do not match a compiler
    require("./compilers/relativecss") // Recommended. keep correct path in css. ex: bootstrap
  ],
  modules: {
    pathCleaner: pathCleaner,
    nameCleaner: function(path, ext = false) {
      if (!config.conventions.vendor(path)) {
        path = path.replace(config.modules.pathCleaner, "$1");
      }
      path = path.replace(/[\\]/g, "/");
      if (ext) {
        return path;
      } 
        return path.replace(/\.[^.]*$/, "");
      
    },
    amdDestination: function(path, ext = false) {
      if (!config.conventions.vendor(path)) {
        path = path.replace(config.modules.pathCleaner, "node_modules/$1");
      }
      path = path.replace(/[\\]/g, "/");
      if (ext) {
        return path;
      } 
        return path.replace(/\.[^.]*$/, "");
      
    },
    wrapper: function(moduleName, data, isVendor) {
      if (isVendor) {
        logger.debug(`Not wrapping '${moduleName}', is vendor file`);
        return data;
      } 
        logger.debug(`commonJs wrapping for '${moduleName}'`);
        return `require.define({"${moduleName}": function(exports, require, module) {\n    ${data}\n}});\n`;
      
    }
  },
  paths: {
    watched: [
      "app",
      "vendor" // only build files in app/ and vendor/
    ]
  },
  files: {
    javascripts: {
      joinTo: {
        "javascripts/app.js": matcher(["app/node_modules/"]),
        "javascripts/vendor.js": joinToVendor
      }
    },
    stylesheets: {
      joinTo: {
        "stylesheets/app.css": matcher(["app/node_modules/", "bower_components/", "components/", "vendor/"], ["app/node_modules/**/variables.styl$"])
      }
    },
    templates: {
      joinTo: "javascripts/app.js"
    }
  },
  plugins: {
    amd: {
      strict: true,
      jshint: false,
      eslint: false,
      package: false,
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
      warnOnly: true,
      config: {
        fix: true,
        ignore: false, // let brunch deal with ignore
        globals: ["define:false"]
      }
    },
    jshint: {
      warnOnly: true
    },
    jst: {
      // _.template uses with when no variable is given. Since with is not recommended on MDN, I prefer not to use it
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with
      variable: "root",
      ignore: /<%--([\s\S]+?)--%>/g, // added for comments within templates
      escape: /<%-([\s\S]+?)%>/g, // default value
      interpolate: /<%=([\s\S]+?)%>/g, // default value
      evaluate: /<%([\s\S]+?)%>/g, // default value
      strict: true,
      esInterpolate: false
    },
    stylus: {
      // http://visionmedia.github.com/nib/
      plugins: [require("nib")()],
      imports: ["nib"]
    }
  },
  initialize: function(config, done) {
    read(sysPath.resolve(config.paths.root), "bower", function(err, components) {
      var component, i, len;
      if (err) {
        throw err;
      }
      for (i = 0, len = components.length; i < len; i++) {
        component = components[i];
        cache["bower_components/" + component.name] = !component.umd;
      }
      done();
    });
  },
  onwatch: function(fswatcher, bwatcher) {
    builder.fswatcher = fswatcher;
    builder.bwatcher = bwatcher;
  },
  // watcher:
  //     ignored: (path)-> /[\\/]\.(?![\\/.])/.test(path)
  //     usePolling: false
  conventions: {
    ignored: [/[\\\/]\.(?![\\\/.])/, /[\\\/]_/, /(?!^|[\\\/])bower\.json/, /(?!^|[\\\/])component\.json/, /(?!^|[\\\/])package\.json/, /(?!^|[\\\/])vendor[\\\/](?:node|j?ruby-.*|bundle)[\\\/]/],
    vendor: function(path) {
      var folder, m, res;
      if (hasProp.call(cache, path)) {
        return cache[path];
      }
      res = cache[path] = anymatch(exports.config.files.javascripts.joinTo["javascripts/vendor.js"])(path);
      if (!res) {
        return res;
      }
      if (m = /^bower_components[\/\\]([^\/\\]+)/.exec(path)) {
        folder = "bower_components/" + m[1];
        if (hasProp.call(cache, folder)) {
          cache[path] = cache[folder];
          return cache[path];
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
