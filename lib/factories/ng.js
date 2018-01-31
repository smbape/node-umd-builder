const sysPath = require("path");

const ngfactory = (plugin, modulePath, data, parsed) => {
    const [locals, ctor, args, head, declaration, _body] = parsed;

    const body = declaration + args.join(", ") + _body;

    const ngmethod = ctor.slice("ng".length);
    const realPath = plugin.config.paths.modules + "/" + modulePath;
    const $name = modulePath.replace(/\//g, ".");
    const $dirname = sysPath.dirname(realPath);
    const $shortName = modulePath.replace(/.*\/([^\/]+)$/, "$1");

    return `
    var ngdeps = [];

    ${head}
    deps.unshift({amd: 'angular', common: '!angular'});
    var ngoffset = deps.length, ngmap = {};

    for (var i = 0, len = ngdeps.length, dep; i < len; i++) {
        dep = ngdeps[i];
        if ('string' === typeof dep && '/' === dep.charAt(0)) {
            ngdeps[i] = dep.slice(1);
            dep = ngdeps[i];
            // deps.length - ngoffset + 1 correspond to ng dependency index
            // that index will be used to know which ngdeps must only by a deps
            // and therefore removed from ngdeps
            ngmap[deps.length - ngoffset + 1] = i;
            deps.push(dep);
        }
    }

    function factory(require, angular${locals ? ", " + locals : ""}) {
        var resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);

        ${body}
        
        return depsLoader.createNgUsable(${ctor}, '${ngmethod}', '${$name}', '${realPath}', '${$dirname}', '${$shortName}', ngdeps, resolvedDeps, ngmap);
    }
    `.replace(/^ {4}/mg, "").trim();
};

const ngmodule = (plugin, modulePath, data, parsed) => {
    const [, , args, head, declaration, _body] = parsed;

    const body = declaration + args.join(", ") + _body;

    return `
    var ngdeps = [];

    ${head}
    deps.unshift({amd: 'angular', common: '!angular'});
    var ngoffset = deps.length, ngmap = {};

    for (var i = 0, len = ngdeps.length, dep; i < len; i++) {
        dep = ngdeps[i];
        if ('string' === typeof dep && '/' === dep.charAt(0)) {
            ngdeps[i] = dep.slice(1);
            dep = ngdeps[i];
            // deps.length - ngoffset + 1 correspond to ng dependency index
            // that index will be used to know which ngdeps must only by a deps
            // and therefore removed from ngdeps
            ngmap[deps.length - ngoffset + 1] = i;
            deps.push(dep);
        }
    }

    function factory(require, angular) {
        /*jshint validthis: true */
        var name = '${modulePath.replace(/\//g, ".")}',
            resolvedDeps = Array.prototype.slice.call(arguments, ngoffset);

        var exports = depsLoader.createNgModule(angular, name, ngdeps, ngmap, resolvedDeps);

        ${body}

        // eslint-disable-next-line no-invalid-this
        ngmodule.apply(this, Array.prototype.slice.call(arguments, 2));
        return exports;
    }`.replace(/^ {4}/mg, "").trim();
};

module.exports = factories => {
    [
        "usable",
        "run",
        "config",
        "module",
        "factory",
        "filter",
        "directive",
        "controller",
        "service",
        "value",
        "constant",
        "decorator",
        "provider"
    ].forEach(name => {
        factories["ng" + name] = ngfactory;
    });

    factories.ngmodule = ngmodule;

    return factories;
};
