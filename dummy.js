var basePath = 'E:/development/git/website/public/';
var filenameMap = {
    'javascripts/main-dev.js': {
        name: 'javascripts/main-dev.js',
        line: 120,
        col: 5
    },
    'node_modules/initialize.js': {
        name: 'initialize',
        line: 7,
        col: 5
    },
    'bower_components/qs/dist/qs.js': {
        name: 'qs',
        line: 1,
        col: 140
    },
    'bower_components/i18next/bin/index.js': {
        name: 'i18next',
        line: 1,
        col: 135
    },
    'node_modules/application.js': {
        name: 'application',
        line: 105,
        col: 20
    },
    'node_modules/configs/Application.js': {
        name: 'configs/Application',
        line: 91,
        col: 20
    },
    'node_modules/lib/StandardApplication.js': {
        name: 'lib/StandardApplication',
        line: 82,
        col: 20
    },
    'node_modules/lib/dynamicRouting.js': {
        name: 'lib/dynamicRouting',
        line: 360,
        col: 20
    },
    'node_modules/lib/menu-usable.js': {
        name: 'lib/menu-usable',
        line: 433,
        col: 20
    },
    'node_modules/configs/menu-items.js': {
        name: 'configs/menu-items',
        line: 76,
        col: 20
    },
    'node_modules/configs/internationalize.js': {
        name: 'configs/internationalize',
        line: 177,
        col: 20
    },
    'node_modules/configs/material.js': {
        name: 'configs/material',
        line: 89,
        col: 20
    },
    'node_modules/configs/patch.js': {
        name: 'configs/patch',
        line: 82,
        col: 20
    },
    'node_modules/umd-core/QueryString.js': {
        name: 'umd-core/QueryString',
        line: 44,
        col: 20
    },
    'node_modules/configs/MainCtrl.js': {
        name: 'configs/MainCtrl',
        line: 182,
        col: 20
    },
    'node_modules/configs/routing.js': {
        name: 'configs/routing',
        line: 75,
        col: 20
    },
    'node_modules/services/RecursionHelper.js': {
        name: 'services/RecursionHelper',
        line: 71,
        col: 20
    },
    'node_modules/configs/resources.js': {
        name: 'configs/resources',
        line: 166,
        col: 20
    },
    'node_modules/lib/ng-i18next.js': {
        name: 'lib/ng-i18next',
        line: 426,
        col: 20
    },
    'node_modules/umd-core/RouterEngine.js': {
        name: 'umd-core/RouterEngine',
        line: 339,
        col: 20
    },
    'node_modules/umd-core/GenericUtil.js': {
        name: 'umd-core/GenericUtil',
        line: 356,
        col: 20
    },
    'node_modules/ng-tutorial/controllers/HomeController.js': {
        name: 'ng-tutorial/controllers/HomeController',
        line: 110,
        col: 20
    },
    'node_modules/lib/AbstractController.js': {
        name: 'lib/AbstractController',
        line: 40,
        col: 20
    }
};


var modulesWithDefine = [];
for (var filename in filenameMap) {
    modulesWithDefine.push(filenameMap[filename].name);
}

config.filenameMap = filenameMap;
config.modulesWithDefine = modulesWithDefine;
var hasOwn = Object.prototype.hasOwnProperty;

config.onReadFile = onReadFile;

function onReadFile(path, text) {
    var relativePath = path.substring(basePath.length);
    if (hasOwn.call(filenameMap, relativePath)) {
        text = ensureAmdName(text, filenameMap[relativePath].name, filenameMap[relativePath].line, filenameMap[relativePath].col);
    }

    return text;
}

function ensureAmdName(str, name, line, col) {
    var start = getIndex(str, line, col);
    var defstart = str.indexOf('(', start);
    return str.substring(0, defstart + 1) + "'" + name + '\', ' + str.substring(defstart + 1);
}

function getIndex(str, line, col) {
    var curr, index, lastIndex;
    if (line === 1) {
        return col;
    }
    curr = 1;
    index = 0;
    lastIndex = -1;
    while (~(index = str.indexOf('\n', index))) {
        lastIndex = index;
        index++;
        if (line === ++curr) {
            break;
        }
    }
    return lastIndex + col;
}