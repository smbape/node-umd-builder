const EslintWorkerPlugin = require("eslint-worker-brunch");

class Eslinter extends EslintWorkerPlugin {

}

Object.assign(Eslinter.prototype, {
    lint: Eslinter.prototype.lintcb,
    lintcb: undefined,
    brunchPlugin: false,
    extension: "js"
});

module.exports = Eslinter;
