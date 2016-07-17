var hasProp = {}.hasOwnProperty;

(function (root, factory) {
  'use strict';

  if (typeof exports !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(['./path-browserify'], factory);
  } else {
    root.depsLoader = factory(root.pathBrowserify);
  }
})(this, function (path) {
  'use strict';

  var amdDefine, amdRequire, browserExtend, commonSpecDefine, commonSpecRequire, exports, extend, has, isObject, localDefine;
  isObject = function (obj) {
    return typeof obj === 'object' && obj !== null;
  };
  extend = function (target, src) {
    var prop;
    if (isObject(src) && isObject(target)) {
      for (prop in src) {
        if (!hasProp.call(src, prop)) continue;
        target[prop] = src[prop];
      }
    }
    return target;
  };
  commonSpecDefine = function (require, type, deps, factory, global) {
    var _processDep, dep, j, len, libs, localRequire;
    if (typeof deps === 'undefined') {
      deps = [];
    }
    localRequire = function (deps, callback, errback, options) {
      return commonSpecRequire(require, type, deps, callback, errback, options, global);
    };
    libs = [localRequire];
    _processDep = function (dep) {
      if (typeof dep === 'undefined') {
        libs.push(null);
        return;
      }
      switch (dep.charAt(0)) {
        case '!':
          if (!global) {
            throw 'global scope is not defined';
          }
          libs.push(global[dep.substring(1)]);
          break;
        case '$':
          libs.push(null);
          break;
        default:
          libs.push(require(dep));
      }
    };
    for (j = 0, len = deps.length; j < len; j++) {
      dep = deps[j];
      if (typeof dep === 'string') {
        _processDep(dep);
      } else if (isObject(dep)) {
        _processDep(dep[type]);
      }
    }
    return factory.apply(global, libs);
  };
  commonSpecRequire = function (require, type, deps, callback, errback, options, global) {
    var _processDep, dep, errors, hasError, j, len, libs;
    if (typeof deps === 'string') {
      deps = [deps];
    } else if (typeof deps === 'undefined') {
      deps = [];
    }
    libs = [];
    errors = [];
    hasError = false;
    _processDep = function (dep) {
      var error, ex;
      if (typeof dep === 'undefined') {
        libs.push(null);
        return;
      }
      switch (dep.charAt(0)) {
        case '!':
          if (!global) {
            throw 'global scope is not defined';
          }
          libs.push(global[dep.substring(1)]);
          break;
        case '$':
          libs.push(null);
          break;
        default:
          try {
            libs.push(require(dep));
          } catch (error) {
            ex = error;
            if (typeof errback !== 'function') {
              throw ex;
            }
            hasError = true;
            errors.push(ex);
          }
      }
    };
    for (j = 0, len = deps.length; j < len; j++) {
      dep = deps[j];
      if (typeof dep === 'string') {
        _processDep(dep);
      } else if (isObject(dep)) {
        _processDep(dep[type]);
      }
    }
    if (hasError) {
      return errback.apply(global, errors);
    } else if (typeof callback === 'function') {
      return callback.apply(global, libs);
    } else if (deps.length === 1) {
      return libs[0];
    }
  };
  amdDefine = function (name, deps, factory, global) {
    var _processDep, availables, callback, dependency, index, j, len, libs, map;
    if (arguments.length === 3) {
      global = factory;
      factory = deps;
      deps = name;
      name = null;
    }
    if (typeof deps === 'undefined') {
      deps = [];
    }
    libs = ['require'];
    availables = [];
    map = {};
    _processDep = function (dep, index) {
      if (typeof dep === 'undefined') {
        availables[index] = null;
        return;
      }
      if (typeof dep === 'string') {
        switch (dep.charAt(0)) {
          case '!':
            if (!global) {
              throw 'global scope is not defined';
            }
            availables[index] = global[dep.substring(1)];
            break;
          case '$':
            availables[index] = null;
            break;
          default:
            map[libs.length] = index;
            libs.push(dep);
        }
      }
    };
    for (index = j = 0, len = deps.length; j < len; index = ++j) {
      dependency = deps[index];
      if (typeof dependency === 'string') {
        _processDep(dependency, index + 1);
      } else if (isObject(dependency)) {
        _processDep(dependency.amd, index + 1);
      }
    }
    callback = function (require) {
      var k, localRequire, ref;
      for (index = k = 1, ref = arguments.length; k < ref; index = k += 1) {
        availables[map[index]] = arguments[index];
      }
      localRequire = function (deps, callback, errback, options) {
        return amdRequire(require, deps, callback, errback, options, global);
      };
      availables[0] = localRequire;
      return factory.apply(this, availables);
    };
    if (name) {
      return define(name, libs, callback);
    } else {
      return define(libs, callback);
    }
  };
  amdRequire = function (require, deps, callback, errback, options, global) {
    var _processDep, availables, dependency, index, j, len, libs, map;
    if (typeof deps === 'string') {
      deps = [deps];
    } else if (typeof deps === 'undefined') {
      deps = [];
    }
    libs = [];
    availables = [];
    map = {};
    _processDep = function (dep, index) {
      var error, ex;
      if (typeof dep === 'undefined') {
        availables[index] = null;
        return;
      }
      if (typeof dep === 'string') {
        switch (dep.charAt(0)) {
          case '!':
            if (!global) {
              throw 'global scope is not defined';
            }
            availables[index] = global[dep.substring(1)];
            break;
          case '$':
            availables[index] = null;
            break;
          default:
            try {
              availables[index] = require(dep);
            } catch (error) {
              ex = error;
              map[libs.length] = index;
              libs.push(dep);
            }
        }
      }
    };
    for (index = j = 0, len = deps.length; j < len; index = ++j) {
      dependency = deps[index];
      if (typeof dependency === 'string') {
        _processDep(dependency, index);
      } else if (isObject(dependency)) {
        _processDep(dependency.amd, index);
      }
    }
    if (typeof callback !== 'function' && deps.length === 1) {
      return availables[0];
    }
    if (libs.length === 0) {
      return callback.apply(global, availables);
    }
    require(libs, function () {
      var k, len1, lib;
      for (index = k = 0, len1 = arguments.length; k < len1; index = ++k) {
        lib = arguments[index];
        availables[map[index]] = lib;
      }
      return callback.apply(global, availables);
    }, errback);
  };
  localDefine = function (workingFile) {
    var fn;
    fn = function (deps) {
      var dep, index, j, len;
      if (Array.isArray(deps)) {
        for (index = j = 0, len = deps.length; j < len; index = ++j) {
          dep = deps[index];
          if (dep.charAt(0) === '.') {
            dep = path.resolve(workingFile, dep);
            deps[index] = dep;
          }
        }
      }
      return define.apply(null, arguments);
    };
    fn.amd = define.amd;
    return fn;
  };
  exports = {
    common: commonSpecDefine,
    amd: amdDefine,
    define: localDefine
  };
  has = Object.prototype.hasOwnProperty;
  exports.createNgModule = function (angular, name, ngdeps, ngmap, resolvedDeps) {
    var app, dusable, index, j, k, l, len, len1, len2, toRegister;
    toRegister = [];
    for (index = j = 0, len = resolvedDeps.length; j < len; index = ++j) {
      dusable = resolvedDeps[index];
      if (dusable.$ng) {
        toRegister.unshift(index);
      }
    }
    for (k = 0, len1 = toRegister.length; k < len1; k++) {
      index = toRegister[k];
      ngdeps.splice(ngmap[index], 1);
    }
    app = angular.module(name, ngdeps);
    app.name = name;
    for (l = 0, len2 = toRegister.length; l < len2; l++) {
      index = toRegister[l];
      resolvedDeps[index](app);
    }
    return app;
  };
  exports.createNgUsable = function (ctor, ngmethod, $name, $path, $dirname, $shortName, ngdeps, resolvedDeps, ngmap) {
    var name, usable;
    switch (ngmethod) {
      case 'controller':
        name = ctor.prototype.$name || (ctor.prototype.$name = $name);
        ctor.prototype.$path = $path;
        ctor.prototype.$dirname = $dirname;
        break;
      case 'directive':
      case 'filter':
        name = $shortName.replace(/\-([a-z])/g, function (match) {
          return match[1].toUpperCase();
        });
        break;
      default:
        name = $name;
    }
    usable = function (app) {
      var dusable, i, index, j, k, len, len1, toRemove, withoutName;
      toRemove = [];
      app.dependencies || (app.dependencies = {});
      app.dependencies[ngmethod] || (app.dependencies[ngmethod] = {});
      if (!has.call(app.dependencies[ngmethod], name)) {
        app.dependencies[ngmethod][name] = true;
        for (i = j = 0, len = resolvedDeps.length; j < len; i = ++j) {
          dusable = resolvedDeps[i];
          if (dusable.$ng) {
            switch (dusable.$ng) {
              case 'usable':
              case 'config':
              case 'run':
              case 'controller':
              case 'directive':
              case 'filter':
                toRemove.unshift(ngmap[i]);
                break;
              default:
                ngdeps[ngmap[i]] = dusable.$name;
            }
            dusable.apply(null, arguments);
          }
        }
        for (k = 0, len1 = toRemove.length; k < len1; k++) {
          index = toRemove[k];
          ngdeps.splice(index, 1);
        }
        if (ngmethod === 'usable') {
          ctor.apply(null, arguments);
          return;
        }
        withoutName = ngmethod === 'config' || ngmethod === 'run';
        if (withoutName) {
          app[ngmethod](ctor);
        } else {
          app[ngmethod](name, ctor);
        }
      }
    };
    ctor.$inject = ngdeps;
    usable.$name = name;
    usable.$path = $path;
    usable.$dirname = $dirname;
    usable.ctor = ctor;
    usable.$ng = ngmethod;
    return usable;
  };
  browserExtend = function (exports) {
    var getContext, getScript, head, isOpera, load, loadScript, onScriptComplete, readyRegExp, removeListener;
    if (typeof window === 'undefined' || typeof window.window !== 'object' || window.window.window !== window.window) {
      return;
    }
    head = document.getElementsByTagName('head')[0];
    isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]';
    load = function (attributes, callback, errback, completeback) {
      var attr, context, node, useInteractive, value;
      node = document.createElement(attributes.tag);
      node.charset = 'utf-8';
      node.async = true;
      for (attr in attributes) {
        if (!hasProp.call(attributes, attr)) continue;
        value = attributes[attr];
        if (attr !== 'tag' && node[attr] !== value) {
          node.setAttribute(attr, value);
        }
      }
      context = getContext(callback, errback, completeback);
      if (node.attachEvent && !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) && !isOpera) {
        useInteractive = true;
        node.attachEvent('onreadystatechange', context.onScriptLoad);
      } else {
        node.addEventListener('load', context.onScriptLoad, false);
        node.addEventListener('error', context.onScriptError, false);
      }
      head.appendChild(node);
    };
    readyRegExp = /^(?:complete|loaded)$/;
    removeListener = function (node, func, name, ieName) {
      if (node.detachEvent && !isOpera) {
        if (ieName) {
          node.detachEvent(ieName, func);
        }
      } else {
        node.removeEventListener(name, func, false);
      }
    };

    /*
    Given an event from a script node, get the requirejs info from it,
    and then removes the event listeners on the node.
    @param {Event} evt
    @returns {Object}
     */
    onScriptComplete = function (context, evt, completeback) {
      var node;
      node = evt.currentTarget || evt.srcElement;
      removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
      removeListener(node, context.onScriptError, 'error');
      if (typeof completeback === 'function') {
        completeback();
      }
    };
    getContext = function (callback, errback, completeback) {
      var context;
      return context = {

        /*
        callback for script loads, used to check status of loading.
        
        @param {Event} evt the event from the browser for the script
        that was loaded.
         */
        onScriptLoad: function (evt) {
          if (evt.type === 'load' || readyRegExp.test((evt.currentTarget || evt.srcElement).readyState)) {
            if (typeof callback === 'function') {
              callback();
            }
            onScriptComplete(context, evt, completeback);
          }
        },

        /*
        Callback for script errors.
         */
        onScriptError: function (evt) {
          if (typeof errback === 'function') {
            errback();
          }
          onScriptComplete(context, evt, completeback);
        }
      };
    };
    exports.load = load;
    exports.getScript = getScript = function (src) {
      var a, found, j, len, script, scripts;
      scripts = head.getElementsByTagName('script');
      a = document.createElement('a');
      a.setAttribute('href', src);
      for (j = 0, len = scripts.length; j < len; j++) {
        script = scripts[j];
        if (script.src === a.href) {
          found = script;
          break;
        }
      }
      a = null;
      return found;
    };
    return exports.loadScript = loadScript = function (src, attributes, callback, errback, completeback) {
      if (getScript(src)) {
        if (typeof callback === 'function') {
          callback();
        }
        if (typeof completeback === 'function') {
          completeback();
        }
        return;
      }
      attributes = extend({
        tag: 'script',
        type: 'text/javascript',
        src: src
      }, attributes);
      load(attributes, callback, errback, completeback);
    };
  };
  browserExtend(exports);
  return exports;
});
