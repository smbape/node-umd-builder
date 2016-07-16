/* jshint node: true */
/* jshint curly: false */
'use strict';

/**
 * Modified version of read-components to track custom properties
 */

var hasProp = {}.hasOwnProperty;
var removeComments = require('./remove-comments');

var sysPath = require('path');
var fs = require('fs');
var each = require('async-each');
var events = require('events');
var emitter = new events.EventEmitter();

var jsonPaths = {
    bower: 'bower.json',
    dotbower: '.bower.json',
    component: 'component.json'
};

var dependencyLocator = {
    bower: 'name',
    component: 'repo'
};

var componentBuilder = require('component-builder');
var Builder = componentBuilder.Builder || componentBuilder;
Builder.prototype.alias = function(a, b) {
    var name = this.root ? this.config.name : this.basename;
    var res = {};
    res[name + '/' + b] = a;
    emitter.emit('addAlias', res);
    return 'require.alias("' + name + '/' + b + '", "' + a + '");';
};

function getDir(root, type, callback) {
    if (type === 'bower') {
        var defaultBowerDir = 'bower_components';
        var bowerrcPath = sysPath.join(root, '.bowerrc');

        fs.exists(bowerrcPath, function(hasBowerrc) {
            if (hasBowerrc) {
                fs.readFile(bowerrcPath, 'utf8', function(error, bowerrcContent) {
                    if (error) return callback(error);

                    var bowerrcJson = JSON.parse(removeComments(bowerrcContent));
                    var bowerrcDirectory = bowerrcJson.directory;
                    callback(null, bowerrcDirectory || defaultBowerDir);
                });
            } else {
                callback(null, defaultBowerDir);
            }
        });
    } else if (type === 'component') {
        return callback(null, 'components');
    } else {
        return callback(null);
    }
}

/**
 * http://www.shamasis.net/2009/09/fast-algorithm-to-find-unique-items-in-javascript-array/
 */
function unique(arr) {
    var o = {},
        l = arr.length,
        r = [],
        i;

    for (i = 0; i < l; i += 1) {
        o[arr[i]] = arr[i];
    }

    for (i in o) {
        r.push(o[i]);
    }
    return r;
}

function sanitizeRepo(repo) {
    if (repo.indexOf('/') !== repo.lastIndexOf('/')) {
        var res = repo.split('/');
        return res[res.length - 1] + '=' + res[res.length];
    }
    return repo.replace('/', '-');
}

function readJson(file, type, callback) {
    fs.exists(file, function(exists) {
        if (!exists) {
            var err = new Error('Component must have "' + file + '"');
            err.code = 'NO_' + type.toUpperCase() + '_JSON';
            return callback(err);
        }

        fs.readFile(file, function(err, contents) {
            if (err) return callback(err);
            contents = contents.toString();

            var json;

            try {
                json = JSON.parse(removeComments(contents));
            } catch (err) {
                err.code = 'EMALFORMED';
                return callback(new Error('Component JSON file is invalid in "' + file + '": ' + err));
            }

            callback(null, json);
        });
    });
}

function getJsonPath(path, type) {
    return sysPath.resolve(sysPath.join(path, jsonPaths[type]));
}

var getPackageFiles = exports.getPackageFiles = function(pkg) {
    var list = [],
        prop;
    ['main', 'scripts', 'styles'].forEach(function(prop) {
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

    if (pkg.map && 'object' === typeof pkg.map) {
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
    var dotpath = getJsonPath(path, 'dotbower');

    function _read(actualPath) {
        readJson(actualPath, type, function(error, pkg) {

            if (error) return callback(error);
            if (overrides) {
                Object.keys(overrides).forEach(function(key) {
                    pkg[key] = overrides[key];
                });
            }

            if (type === 'bower' && !pkg.main) {
                return callback(new Error('Component JSON file "' + actualPath + '" must have `main` property. See https://github.com/paulmillr/read-components#README'));
            }

            var files = getPackageFiles(pkg).map(function(relativePath) {
                return sysPath.join(path, relativePath);
            });

            var obj = {
                    files: files,
                    repo: sysPath.basename(path),
                    dependencies: pkg.dependencies || {},
                    package: pkg
                },
                properties = ['name', 'version', 'type', 'umd', 'exports', 'ignore', 'paths', 'map'],
                prop, i, len;

            for (i = 0, len = properties.length; i < len; i++) {
                prop = properties[i];
                if (hasProp.call(pkg, prop)) {
                    obj[prop] = pkg[prop];
                }
            }

            callback(null, obj);
        });
    }
    fs.exists(dotpath, function(isStableBower) {
        _read(isStableBower ? dotpath : fullPath);
    });
}

function gatherDeps(packages, type) {
    return Object.keys(packages.reduce(function(obj, item) {
        if (!obj[item[dependencyLocator[type]]]) obj[item[dependencyLocator[type]]] = true;
        Object.keys(item.dependencies).forEach(function(dep) {
            dep = sanitizeRepo(dep);
            if (!obj[dep]) obj[dep] = true;
        });
        return obj;
    }, {}));
}

function readPackages(root, type, allProcessed, list, overrides, callback) {
    getDir(root, type, function(error, dir) {
        if (error) return callback(error);

        var parent = sysPath.join(root, dir);
        var paths = list.map(function(item) {
            if (type === 'component') item = sanitizeRepo(item);
            return {
                path: sysPath.join(parent, item),
                overrides: overrides[item]
            };
        });

        each(paths, processPackage.bind(null, type), function(error, newProcessed) {
            if (error) return callback(error);
            var processed = allProcessed.concat(newProcessed);

            var processedNames = {};
            processed.forEach(function(_) {
                processedNames[_[dependencyLocator[type]]] = true;
            });

            var newDeps = gatherDeps(newProcessed, type).filter(function(item) {
                return !processedNames[item];
            });

            if (newDeps.length === 0) {
                callback(error, processed);
            } else {
                readPackages(root, type, processed, newDeps, overrides, callback);
            }
        });
    });
}

// Find an item in list.
function find(list, predicate) {
    for (var i = 0, length = list.length, item; i < length; i++) {
        item = list[i];
        if (predicate(item)) return item;
    }
}

// Iterate recursively over each dependency and increase level
// on each iteration.
function setSortingLevels(packages, type) {
    packages.forEach(setLevel.bind(null, 1));
    return packages;

    function setLevel(initial, pkg) {
        var level = Math.max(pkg.sortingLevel || 0, initial);
        var deps = Object.keys(pkg.dependencies);
        // console.log('setLevel', pkg.name, level);
        pkg.sortingLevel = level;
        deps.forEach(function(depName) {
            depName = sanitizeRepo(depName);
            var dep = find(packages, function(_) {
                if (type === 'component') {
                    var repo = _[dependencyLocator[type]];
                    if (repo === depName)
                        return true;
                    // nasty hack to ensure component repo ends with the specified repo
                    // e.g. "repo": "https://raw.github.com/component/typeof"
                    var suffix = '/' + depName;
                    return repo.indexOf(suffix, repo.length - suffix.length) !== -1;
                } else {
                    return _[dependencyLocator[type]] === depName;
                }
            });

            if (!dep) {
                var names = Object.keys(packages).map(function(_) {
                    return packages[_].name;
                }).join(', ');
                throw new Error('Dependency "' + depName + '" is not present in the list of deps [' + names + ']. Specify correct dependency in ' + type + '.json or contact package author.');
            }
            setLevel(initial + 1, dep);
        });
    }
}

// Sort packages automatically, bas'component'ed on their dependencies.
function sortPackages(packages, type) {
    return setSortingLevels(packages, type).sort(function(a, b) {
        return b.sortingLevel - a.sortingLevel;
    });
}

function init(directory, type, callback) {
    readJson(sysPath.join(directory, jsonPaths[type]), type, callback);
}


function readComponents(directory, callback, type) {
    if (typeof directory === 'function') {
        callback = directory;
        directory = null;
    }
    if (directory === null) directory = '.';

    init(directory, type, function(error, json) {
        if (error) {
            if (error.code === 'NO_' + type.toUpperCase() + '_JSON') {
                return callback(null, []);
            } else {
                return callback(error);
            }
        }

        var deps = Object.keys(json.dependencies || {});
        var overrides = json.overrides || {};

        readPackages(directory, type, [], deps, overrides, function(error, data) {
            if (error) return callback(error);
            var sorted = sortPackages(data, type),
                builder,
                aliases = [];
            if (type === 'component') {
                builder = new Builder(directory);
                emitter.on('addAlias', function(alias) {
                    aliases.push(alias);
                });
                builder.buildAliases(function(err, res) {
                    callback(null, sorted, aliases);
                });
            } else
                callback(null, sorted);
        });
    });
}

function read(root, type, callback) {
    if (type === 'bower') {
        readComponents(root, callback, type);
    } else if (type === 'component') {
        readComponents(root, callback, type);
    } else {
        throw new Error('read-components: unknown type');
    }
}

module.exports = read;