const sysPath = require("path");

module.exports = function resolveFrom(start, moduleName) {
    var dirname = sysPath.dirname(require.resolve(start + "/package.json"));
    var parts = dirname.split(/[\\/]/g);
    var index = parts.length;
    var currentFile;

    var err = 1;
    while (err && index !== 0) {
        err = 0;
        currentFile = [parts.slice(0, index--).join(sysPath.sep), "node_modules", moduleName].join(sysPath.sep);

        try {
            return require.resolve(currentFile);
        } catch ( _err ) {
            err = _err;
        }
    }

    return null;
};