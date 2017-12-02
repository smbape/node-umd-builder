const sysPath = require("path");

Object.assign(exports, {
    makeModule: (filename, parent) => {
        filename = sysPath.resolve(filename);
        const Module = parent.constructor;
        const localModule = new Module(filename, parent);
        const dirname = sysPath.dirname(filename);
        localModule.filename = filename;
        localModule.paths = Module._nodeModulePaths(dirname);
        const localRequire = exports.makeRequireFunction(localModule);

        return {
            exports: localModule.exports,
            module: localModule,
            require: localRequire,
            __filename: filename,
            __dirname: dirname
        };
    },

    makeRequireFunction: localModule => {
        const Module = localModule.constructor;
        const localRequire = localModule.require.bind(localModule);

        localRequire.resolve = (request, options) => {
            return Module._resolveFilename(request, localModule, false, options);
        };

        localRequire.main = process.mainModule;

        // Enable support to add extra extension types.
        localRequire.extensions = Module._extensions;

        localRequire.cache = Module._cache;

        return localRequire;
    }
});
