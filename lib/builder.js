var INDEX_FILE, UglifyJSOptimizer, _, _compileBowerFile, _compileIndex, _matchBowerFiles, _processComponent, _writeData, _writeMainFile, anymatch, anyspawn, beautify, build, buildBower, buildClient, buildSem, capitalize, chokidar, cluster, compileIndex, emptyFn, explore, exploreClientFiles, fs, hasProp, initConfig, isFile, isFileSync, log4js, logger, mkdirp, self, semLib, sysPath, util, watchClientFiles;

log4js = require('../log4js');

cluster = require('cluster');

util = require('util');

fs = require('fs');

mkdirp = require('mkdirp');

sysPath = require('path');

_ = require('lodash');

explore = require('fs-explorer').explore;

semLib = require('sem-lib');

anymatch = require('anymatch');

logger = log4js.getLogger('umd-builder');

chokidar = require('chokidar');

UglifyJSOptimizer = require('uglify-js-brunch');

beautify = require('js-beautify').js_beautify;

anyspawn = require('anyspawn');

_.template = require('./compilers/jst/template');

_.templateSettings.variable = 'root';

_.templateSettings.ignore = /<%--([\s\S]+?)--%>/g;

hasProp = {}.hasOwnProperty;

initConfig = function(options) {
  var APPLICATION_PATH, BOWER_COMPONENTS_RELATIVE_PATH, BOWER_COMPONENTS_URL, BOWER_PUBLIC_PATH, CLIENT_ASSETS_PATH, CLIENT_ASSETS_RELATIVE_PATH, CLIENT_MODULES_PATH, CLIENT_MODULES_URL, CLIENT_PATH, CLIENT_RELATIVE_PATH, PUBLIC_PATH, config;
  config = options._c = {};
  if (options.optimize) {
    config.optimizer = new UglifyJSOptimizer(options);
  }
  APPLICATION_PATH = sysPath.resolve(options.paths.root);
  CLIENT_RELATIVE_PATH = options.paths.watched[0];
  CLIENT_PATH = sysPath.join(APPLICATION_PATH, CLIENT_RELATIVE_PATH);
  CLIENT_ASSETS_PATH = sysPath.join(CLIENT_PATH, 'assets');
  CLIENT_ASSETS_RELATIVE_PATH = sysPath.relative(CLIENT_PATH, CLIENT_ASSETS_PATH);
  BOWER_COMPONENTS_RELATIVE_PATH = 'bower_components';
  PUBLIC_PATH = sysPath.resolve(APPLICATION_PATH, options.paths["public"]);
  CLIENT_MODULES_URL = options.paths.modules || 'node_modules';
  CLIENT_MODULES_PATH = sysPath.join(PUBLIC_PATH, CLIENT_MODULES_URL);
  BOWER_PUBLIC_PATH = sysPath.join(PUBLIC_PATH, BOWER_COMPONENTS_RELATIVE_PATH);
  BOWER_COMPONENTS_URL = sysPath.relative(CLIENT_MODULES_PATH, BOWER_PUBLIC_PATH).replace(/[\\]/g, '/');
  config.paths = {
    APPLICATION_PATH: APPLICATION_PATH,
    CLIENT_RELATIVE_PATH: CLIENT_RELATIVE_PATH,
    CLIENT_PATH: CLIENT_PATH,
    CLIENT_ASSETS_PATH: CLIENT_ASSETS_PATH,
    CLIENT_ASSETS_RELATIVE_PATH: CLIENT_ASSETS_RELATIVE_PATH,
    BOWER_COMPONENTS_RELATIVE_PATH: BOWER_COMPONENTS_RELATIVE_PATH,
    PUBLIC_PATH: PUBLIC_PATH,
    CLIENT_MODULES_URL: CLIENT_MODULES_URL,
    CLIENT_MODULES_PATH: CLIENT_MODULES_PATH,
    BOWER_PUBLIC_PATH: BOWER_PUBLIC_PATH,
    BOWER_COMPONENTS_URL: BOWER_COMPONENTS_URL
  };
  return options._c;
};

emptyFn = function() {};

capitalize = function(str) {
  if (typeof str === 'string' && str.length > 0) {
    return str[0].toUpperCase() + str.substring(1);
  }
  return str;
};

isFile = function(path, next) {
  fs.exists(path, function(exists) {
    if (!exists) {
      return next(null, exists);
    }
    fs.lstat(path, function(err, stats) {
      if (err) {
        return next(err);
      }
      next(err, stats.isFile() && path);
    });
  });
};

isFileSync = function(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isFile() && path;
};

buildBower = function(options, done) {
  var config, count, give, read, take;
  logger.info('Build Bower start');
  config = {
    enforceDefine: false,
    baseUrl: options._c.paths.CLIENT_MODULES_URL,
    paths: {},
    groups: {},
    shim: {},
    deps: []
  };
  config = _.defaultsDeep({}, options.requirejs, config);
  config.map || (config.map = {});
  config.map['*'] || (config.map['*'] = {});
  count = 0;
  take = function() {
    return ++count;
  };
  give = function(err) {
    if (--count === 0 || err) {
      if (err) {
        logger.error('Error while building bower components', err);
        done(err);
        return;
      }
      _writeMainFile(config, options, function(err) {
        if (err) {
          logger.error('Error while building bower components', err);
          done(err);
          return;
        }
        logger.info('Build Bower finish');
        done(err);
      });
    }
  };
  read = require('../utils/read-components');
  read(sysPath.resolve(options._c.paths.APPLICATION_PATH), 'bower', function(err, components) {
    var component, i, len;
    if (err) {
      return give(err);
    }
    take();
    for (i = 0, len = components.length; i < len; i++) {
      component = components[i];
      take();
      _processComponent(component, config, options, give);
    }
    give();
  });
};

_processComponent = function(component, config, options, done) {
  var componentDir, count, give, groupIndex, i, isScript, j, len, len1, map, memo, name, opts, path, processed, prop, ref, ref1, ref2, take, task;
  if (component.umd) {
    done();
    return;
  }
  if (!(component.files instanceof Array)) {
    return done();
  }
  name = component.name;
  if (component.lazy) {
    logger.debug('lazy', name);
  } else {
    config.deps.push(name);
  }
  count = 0;
  take = function() {
    return ++count;
  };
  give = function(err) {
    var idx;
    if (--count === 0 || err) {
      if (!memo.hasJs) {
        delete config.paths[name];
        if (~(idx = config.deps.indexOf(name))) {
          config.deps.splice(idx, 1);
        }
      }
      done(err);
      give = function() {};
    }
  };
  take();
  processed = {};
  groupIndex = 0;
  memo = {
    processed: processed,
    groupIndex: groupIndex
  };
  componentDir = sysPath.resolve(options._c.paths.BOWER_COMPONENTS_RELATIVE_PATH, name);
  task = function(path, opts) {
    take();
    path = path.replace(/[\\]/g, '/');
    if (/\*/.test(path)) {
      _matchBowerFiles(component, config, {
        path: path,
        componentDir: componentDir,
        memo: memo
      }, options, opts, give);
    } else {
      _compileBowerFile(path, component, config, memo, false, options, opts, give);
    }
  };
  ref = ['main', 'scripts', 'styles'];
  for (i = 0, len = ref.length; i < len; i++) {
    prop = ref[i];
    isScript = prop === 'scripts';
    ref1 = component["package"][prop];
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      path = ref1[j];
      task(path, {
        isScript: isScript
      });
    }
  }
  if (component.map) {
    opts = {};
    ref2 = component.map;
    for (path in ref2) {
      map = ref2[path];
      task(path, {
        map: map
      });
    }
  }
  give();
};

_matchBowerFiles = function(component, config, arg, options, opts, done) {
  var componentDir, matcher, memo, path, start;
  path = arg.path, componentDir = arg.componentDir, memo = arg.memo;
  matcher = anymatch([path]);
  start = componentDir.length + 1;
  explore(componentDir, function(path, stats, next) {
    var relativePath;
    relativePath = path.substring(start).replace(/[\\]/g, '/');
    if (matcher(relativePath)) {
      _compileBowerFile(path, component, config, memo, true, options, opts, next);
      return;
    }
    return next();
  }, done);
};

_compileBowerFile = function(path, component, config, memo, isAbsolutePath, options, opts, done) {
  var absolutePath, configPaths, destFile, extname, groupIndex, name, pathext, paths, plugin, processed, shim;
  name = component.name;
  configPaths = options._c.paths;
  processed = memo.processed, groupIndex = memo.groupIndex;
  if (isAbsolutePath) {
    absolutePath = path;
    path = sysPath.relative(sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name), path);
  } else {
    absolutePath = sysPath.resolve(configPaths.BOWER_COMPONENTS_RELATIVE_PATH, name, path);
  }
  if (hasProp.call(processed, absolutePath)) {
    return done();
  }
  logger.trace("compiling bower file " + component.name + ", " + path);
  processed[absolutePath] = true;
  extname = sysPath.extname(path);
  destFile = sysPath.resolve(configPaths.BOWER_PUBLIC_PATH, name, path);
  if (options.jsExtensions.test(extname)) {
    memo.hasJs = true;
    pathext = configPaths.BOWER_COMPONENTS_URL + '/' + sysPath.join(name, path).replace(/[\\]/g, '/');
    path = pathext.replace(/\.js$/, '');
    if (typeof config.paths[name] === 'undefined' && !opts.isScript && !opts.map) {
      if (component.exports) {
        shim = {
          exports: component.exports
        };
        if (typeof component.dependencies === 'object' && component.dependencies !== null) {
          shim.deps = Object.keys(component.dependencies);
        }
        config.shim[name] = shim;
      }
      if (typeof component.paths === 'string') {
        paths = [component.paths, path];
      } else if (Array.isArray(component.paths)) {
        paths = component.paths;
        paths.push(path);
      } else {
        paths = path;
      }
      config.paths[name] = paths;
      config.map['*'][path] = name;
    } else {
      logger.debug("[" + name + "] add [" + path + "] as group");
      if (opts.map) {
        plugin = opts.map;
        if (hasProp.call(config.paths, plugin)) {
          done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path name"));
          return;
        }
        config.paths[plugin] = path;
        config.map['*'][path] = plugin;
      } else {
        if (component.exports) {
          plugin = name + ('' + Math.random()).replace(/\D/g, '');
        } else {
          plugin = path;
        }
        if (hasProp.call(config.paths, plugin)) {
          done(new Error("[" + name + "] - Cannot add [" + plugin + "] to groups. Already exists as path name"));
          return;
        }
      }
      if (component.exports) {
        config.shim[plugin] = {
          exports: component.exports,
          deps: [name]
        };
      }
      if (!hasProp.call(config.groups, name)) {
        config.groups[name] = [name];
      }
      config.groups[name].push(plugin);
    }
  }
  done();
};

_writeMainFile = function(config, options, done) {
  var index, iterate, keys, length, pathBrowserify, source, srcPath, template, tplOpts, types;
  pathBrowserify = config['path-browserify'] || 'umd-core/path-browserify';
  delete config['path-browserify'];
  srcPath = sysPath.resolve(__dirname, '../templates/main.js');
  source = fs.readFileSync(srcPath, 'utf8');
  template = _.template(source);
  tplOpts = {
    require: require,
    __filename: srcPath,
    __dirname: sysPath.dirname(srcPath),
    config: config,
    pathBrowserify: pathBrowserify,
    paths: options.paths,
    optimize: !!options._c.optimizer,
    root: options._c.paths.APPLICATION_PATH,
    "public": options._c.paths.PUBLIC_PATH
  };
  types = {
    build: [sysPath.resolve(options._c.paths.APPLICATION_PATH, 'work/rbuild.js'), 'work/rbuild.js'],
    unit: [sysPath.resolve(options._c.paths.APPLICATION_PATH, 'test/unit/test-main.js'), 'test/unit/test-main.js'],
    main: [sysPath.resolve(options._c.paths.PUBLIC_PATH, 'javascripts/main.js'), 'javascripts/main.js'],
    'main-dev': [sysPath.resolve(options._c.paths.PUBLIC_PATH, 'javascripts/main-dev.js'), 'javascripts/main-dev.js']
  };
  keys = Object.keys(types);
  index = 0;
  length = keys.length;
  iterate = function(err) {
    var data, opts;
    if (err || index === length) {
      done(err);
      return;
    }
    tplOpts.type = keys[index++];
    data = template(tplOpts);
    opts = tplOpts.type === 'main-dev' ? {
      optimizer: options._c.optimizer
    } : {};
    _writeData(data, types[tplOpts.type][0], types[tplOpts.type][1], opts, iterate);
  };
  iterate();
};

_writeData = function(data, dst, path, options, done) {
  mkdirp(sysPath.dirname(dst), function(err) {
    var writer;
    if (err) {
      return done(err);
    }
    writer = fs.createWriteStream(dst, {
      flags: 'w'
    });
    if (options.optimizer) {
      options.optimizer.optimize({
        data: data,
        path: path
      }, function(err, arg) {
        var map, optimized, path;
        optimized = arg.data, path = arg.path, map = arg.map;
        if (err) {
          return done(err);
        }
        writer.write(optimized || data);
        done();
      });
    } else {
      writer.write(beautify(data, {
        indent_with_tabs: false,
        preserve_newlines: true,
        max_preserve_newlines: 4,
        space_in_paren: false,
        jslint_happy: false,
        brace_style: 'collapse',
        keep_array_indentation: false,
        keep_function_indentation: false,
        eval_code: false,
        unescape_strings: false,
        break_chained_methods: false,
        e4x: false,
        wrap_line_length: 0
      }));
      done();
    }
  });
};

compileIndex = (function() {
  var timeWindow, timeout;
  timeWindow = 500;
  timeout = void 0;
  return function() {
    var args, context;
    context = this;
    args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      _compileIndex.apply(context, args);
    }, timeWindow);
  };
})();

_compileIndex = function(path, options) {
  var configPaths, destFileClassic, destFileSingle, e, error, source, srcpath, template, tplOpts;
  configPaths = options._c.paths;
  srcpath = sysPath.resolve(configPaths.CLIENT_ASSETS_PATH, path);
  source = fs.readFileSync(srcpath, 'utf8');
  tplOpts = {
    require: require,
    __filename: srcpath,
    __dirname: sysPath.dirname(srcpath),
    optimize: !!options._c.optimizer
  };
  try {
    template = _.template(source);
    destFileSingle = sysPath.resolve(configPaths.PUBLIC_PATH, 'index.single.html');
    fs.writeFileSync(destFileSingle, template(_.defaults({
      build: 'app'
    }, tplOpts)));
    destFileClassic = sysPath.resolve(configPaths.PUBLIC_PATH, 'index.classic.html');
    fs.writeFileSync(destFileClassic, template(_.defaults({
      build: 'web'
    }, tplOpts)));
    return logger.info('compiled index file');
  } catch (error) {
    e = error;
    return logger.error(e);
  }
};

buildClient = function(config, options, extra, next) {
  var command, configPaths, dstpath, indexPath, ref, ref1, srcpath, type, watcher;
  if (extra.watcher) {
    watcher = extra.watcher;
    indexPath = sysPath.join(config.paths.CLIENT_ASSETS_PATH, INDEX_FILE);
    watcher.on('ready', function() {
      compileIndex(indexPath, options);
    });
    watcher.on('change', function(path) {
      compileIndex(indexPath, options, path);
    });
    next();
    return;
  }
  if (cluster.isMaster) {
    if (options.links) {
      ref = options.links;
      for (dstpath in ref) {
        srcpath = ref[dstpath];
        configPaths = options._c.paths;
        dstpath = sysPath.join(configPaths.PUBLIC_PATH, dstpath);
        if ('string' === typeof srcpath) {
          type = 'file';
        } else {
          ref1 = srcpath, srcpath = ref1[0], type = ref1[1];
        }
        srcpath = sysPath.resolve(configPaths.APPLICATION_PATH, srcpath);
        logger.info("link\n    " + srcpath + "\n    " + dstpath);
        fs.symlink(srcpath, dstpath, type, function(err) {
          if (err && (err.code !== 'EEXIST' || err.path !== srcpath)) {
            logger.error(err);
          }
        });
      }
    }
    command = process.argv[2];
    if (command === 'watch' || command === 'w') {
      watchClientFiles(options, next);
      return;
    }
    exploreClientFiles(options, next);
  }
};

INDEX_FILE = 'index.jst';

watchClientFiles = function(options, next) {
  var watcher;
  logger.info('Start watching client files');
  watcher = chokidar.watch(sysPath.join(options._c.paths.CLIENT_ASSETS_PATH, INDEX_FILE));
  watcher.on('add', function(path) {
    compileIndex(path, options);
  }).on('change', function(path) {
    compileIndex(path, options);
  });
  if ('function' === typeof next) {
    next();
  }
};

exploreClientFiles = function(options, next) {
  compileIndex(INDEX_FILE, options);
  next();
};

buildSem = semLib.semCreate(1, true);

build = function(options, next) {
  var self;
  self = build;
  if (self.config) {
    return next(self.config);
  }
  if (self.building) {
    buildSem.semTake(function() {
      next(self.config);
    });
    return;
  }
  self.building = true;
  options = self.options = _.clone(options);
  self.config = initConfig(options);
  buildSem.semTake(function() {
    buildBower(options, function(err) {
      if (err) {
        throw err;
      }
      self.building = false;
      next(self.config);
    });
  });
};

self = {};

exports.getConfig = function() {
  return self.config;
};

exports.buildClient = function(extra, done) {
  buildClient(self.config, self.options, extra, done || (function() {}));
};

exports.buildBower = function(options, done) {
  options = self.options = _.clone(options);
  self.config = initConfig(options);
  options.jsExtensions || (options.jsExtensions = /\.js$/);
  buildBower(options, function() {
    done(self.config);
  });
};
