const path = require("path");

exports.makeModule = makeModule;
function makeModule(filename, parent) {
    filename = path.resolve(filename);
    const Module = parent.constructor;
    const localModule = new Module(filename, parent);
    const dirname = path.dirname(filename);
    localModule.filename = filename;
    localModule.paths = Module._nodeModulePaths(dirname);
    const localRequire = makeRequireFunction.call(localModule);

    return {
        exports: localModule.exports,
        module: localModule,
        require: localRequire,
        __filename: filename,
        __dirname: dirname
    };
}

exports.makeRequireFunction = makeRequireFunction;
function makeRequireFunction() {
    const Module = this.constructor;
    const self = this;
    const require = self.require.bind(self);

    function resolve(request) {
        return Module._resolveFilename(request, self);
    }

    require.resolve = resolve;

    require.main = process.mainModule;

    // Enable support to add extra extension types.
    require.extensions = Module._extensions;

    require.cache = Module._cache;

    return require;
}