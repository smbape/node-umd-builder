const csso = require("csso");
const anymatch = require("anymatch");

class CssoOptimizer {
    constructor(config) {
        this.options = Object.assign({}, config && config.plugins && config.plugins.csso);
        this.sourceMap = Boolean(config.sourceMaps);
        if (this.options.ignored) {
            this.isIgnored = anymatch(this.options.ignored);
        }
    }

    optimize(params, callback) {
        const {data, path, map} = params;

        const {ignored} = this.options;
        let optimized;

        if (this.isIgnored && typeof ignored === "function" && this.isIgnored(path)) {
            callback(null, params);
            return;
        }

        const options = Object.assign({
            sourceMap: map || this.sourceMap
        }, this.options, {
            filename: path
        });

        try {
            optimized = csso.minify(data, options);
            callback(null, {
                path: path,
                data: optimized.css,
                map: optimized.map
            });
        } catch (err) {
            callback(err);
        }
    }
}

CssoOptimizer.prototype.brunchPlugin = true;
CssoOptimizer.prototype.type = "stylesheet";

module.exports = CssoOptimizer;