"use strict";

/* eslint-disable func-style */

/**
 * Modified version of read-components to track custom properties
 */

var hasProp = {}.hasOwnProperty;
var stripJsonComments = require("strip-json-comments");

var sysPath = require("path");
var fs = require("fs");
var each = require("async-each");

var jsonPaths = {
  bower: "bower.json",
  dotbower: ".bower.json",
  component: "component.json",
};

var dependencyLocator = {
  bower: "name",
  component: "repo",
};

function getDir(root, type, callback) {
  if (type === "bower") {
    var defaultBowerDir = "bower_components";
    var bowerrcPath = sysPath.join(root, ".bowerrc");

    fs.access(bowerrcPath, error => {
      if (error) {
        callback(null, defaultBowerDir);
        return;
      }

      fs.readFile(bowerrcPath, "utf8", (error, bowerrcContent) => {
        if (error) {
          callback(error);
          return;
        }

        var bowerrcJson = JSON.parse(stripJsonComments(bowerrcContent));
        var bowerrcDirectory = bowerrcJson.directory;
        callback(null, bowerrcDirectory || defaultBowerDir);
      });
    });
  } else {
    callback(null);
    
  }
}

// Return unique list items.
function unique(list) {
  return Object.keys(list.reduce((obj, key) => {
    if (!hasProp.call(obj, key)) {
      obj[key] = true;
    }
    return obj;
  }, {}));
}

function sanitizeRepo(repo) {
  if (repo.indexOf("/") !== repo.lastIndexOf("/")) {
    var res = repo.split("/");
    return res[res.length - 1] + "=" + res[res.length];
  }
  return repo.replace("/", "-");
}

function readJson(file, type, callback) {
  fs.access(file, error => {
    if (error) {
      var err = new Error("Component must have \"" + file + "\"");
      err.code = "NO_" + type.toUpperCase() + "_JSON";
      callback(err);
      return;
    }

    fs.readFile(file, (err, contents) => {
      if (err) {
        callback(err);
        return;
      }

      var json;

      try {
        json = JSON.parse(stripJsonComments(contents.toString()));
      } catch ( _err ) {
        _err.code = "EMALFORMED";
        callback(new Error("Component JSON file is invalid in \"" + file + "\": " + _err));
        return;
      }

      callback(null, json);
    });
  });
}

function getJsonPath(path, type) {
  return sysPath.resolve(sysPath.join(path, jsonPaths[type]));
}

var getPackageFiles = exports.getPackageFiles = function(pkg) {
  var list = [];
  ["main", "scripts", "styles"].forEach(prop => {
    if (pkg[prop]) {
      if (Array.isArray(pkg[prop])) {
        list.push.apply(list, pkg[prop]);
      } else {
        list.push(pkg[prop]);
        pkg[prop] = [pkg[prop]];
      }
    } else {
      pkg[prop] = [];
    }
  });

  if (pkg.map && typeof pkg.map === "object") {
    list.push.apply(list, Object.keys(pkg.map));
  } else {
    pkg.map = {};
  }

  return unique(list);
};

function processPackage(type, pkg, callback) {
  var path = pkg.path;
  var overrides = pkg.overrides;
  var fullPath = getJsonPath(path, type);
  var dotpath = getJsonPath(path, "dotbower");

  function _read(actualPath) {
    readJson(actualPath, type, (error, pkg) => {

      if (error) {
        callback(error);
        return;
      }
      if (overrides) {
        Object.keys(overrides).forEach(key => {
          pkg[key] = overrides[key];
        });
      }

      if (type === "bower" && !pkg.main) {
        callback(new Error("Component JSON file \"" + actualPath + "\" must have `main` property. See https://github.com/paulmillr/read-components#README"));
        return;
      }

      var files = getPackageFiles(pkg).map(relativePath => {
        return sysPath.join(path, relativePath);
      });

      var obj = {
          files,
          repo: sysPath.basename(path),
          dependencies: pkg.dependencies || {},
          package: pkg,
        },
        properties = ["name", "version", "type", "umd", "exports", "lazy", "paths", "map"], prop, i, len;

      for (i = 0, len = properties.length; i < len; i++) {
        prop = properties[i];
        if (hasProp.call(pkg, prop)) {
          obj[prop] = pkg[prop];
        }
      }

      callback(null, obj);
    });
  }
  fs.access(dotpath, isUnstableBower => {
    _read(isUnstableBower ? fullPath : dotpath);
  });
}

function gatherDeps(packages, type) {
  return Object.keys(packages.reduce((obj, item) => {
    if (!obj[item[dependencyLocator[type]]]) {
      obj[item[dependencyLocator[type]]] = true;
    }
    Object.keys(item.dependencies).forEach(dep => {
      dep = sanitizeRepo(dep);
      if (!obj[dep]) {
        obj[dep] = true;
      }
    });
    return obj;
  }, {}));
}

function readPackages(root, type, allProcessed, list, overrides, callback) {
  getDir(root, type, (error, dir) => {
    if (error) {
      callback(error);
      return;
    }

    var parent = sysPath.join(root, dir);
    var paths = list.map(item => {
      if (type === "component") {
        item = sanitizeRepo(item);
      }
      return {
        path: sysPath.join(parent, item),
        overrides: overrides[item],
      };
    });

    each(paths, processPackage.bind(null, type), (error, newProcessed) => {
      if (error) {
        callback(error);
        return;
      }
      var processed = allProcessed.concat(newProcessed);

      var processedNames = {};
      processed.forEach(_ => {
        processedNames[_[dependencyLocator[type]]] = true;
      });

      var newDeps = gatherDeps(newProcessed, type).filter(item => {
        return !processedNames[item];
      });

      if (newDeps.length === 0) {
        callback(error, processed);
        return;
      }
      readPackages(root, type, processed, newDeps, overrides, callback);
    });
  });
}

// Find an item in list.
function find(list, predicate) { // eslint-disable-line consistent-return
  for (var i = 0, length = list.length, item; i < length; i++) {
    item = list[i];
    if (predicate(item)) {
      return item;
    }
  }
}

// Iterate recursively over each dependency and increase level
// on each iteration.
function setSortingLevels(packages, type) {
  function setLevel(initial, pkg) {
    var level = Math.max(pkg.sortingLevel || 0, initial);
    var deps = Object.keys(pkg.dependencies);
    // console.log('setLevel', pkg.name, level);
    pkg.sortingLevel = level;
    deps.forEach(depName => {
      depName = sanitizeRepo(depName);
      var dep = find(packages, _ => {
        if (type === "component") {
          var repo = _[dependencyLocator[type]];
          if (repo === depName) {
            return true;
          }
          // nasty hack to ensure component repo ends with the specified repo
          // e.g. "repo": "https://raw.github.com/component/typeof"
          var suffix = "/" + depName;
          return repo.indexOf(suffix, repo.length - suffix.length) !== -1;
        }
        return _[dependencyLocator[type]] === depName;
      });

      if (!dep) {
        var names = Object.keys(packages).map(_ => {
          return packages[_].name;
        }).join(", ");
        throw new Error("Dependency \"" + depName + "\" is not present in the list of deps [" + names + "]. Specify correct dependency in " + type + ".json or contact package author.");
      }
      setLevel(initial + 1, dep);
    });
  }
  packages.forEach(setLevel.bind(null, 1));
  return packages;
}

// Sort packages automatically, bas'component'ed on their dependencies.
function sortPackages(packages, type) {
  return setSortingLevels(packages, type).sort((a, b) => {
    return b.sortingLevel - a.sortingLevel;
  });
}

function init(directory, type, callback) {
  readJson(sysPath.join(directory, jsonPaths[type]), type, callback);
}

function readComponents(directory, callback, type) {
  if (typeof directory === "function") {
    callback = directory;
    directory = null;
  }
  if (directory === null) {
    directory = ".";
  }

  init(directory, type, (error, json) => {
    if (error) {
      if (error.code === "NO_" + type.toUpperCase() + "_JSON") {
        callback(null, []);
        return;
      }
      callback(error);
      return;
    }

    var deps = Object.keys(json.dependencies || {});
    var overrides = json.overrides || {};

    readPackages(directory, type, [], deps, overrides, (error, data) => {
      if (error) {
        callback(error);
        return;
      }
      var sorted = sortPackages(data, type);
      callback(null, sorted);
    });
  });
}

function read(root, type, callback) {
  if (type === "bower") {
    readComponents(root, callback, type);
  } else {
    throw new Error("read-components: unknown type " + type);
  }
}

module.exports = read;
