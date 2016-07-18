var esprima = require('esprima');

function EsprimaCompiler(config) {
    var config = config && config.plugins && config.plugins.esprima;
    this.validate = config && config.hasOwnProperty('validate') ? !!config.validate : true;
}

EsprimaCompiler.brunchPluginName = 'esprima-brunch';
EsprimaCompiler.prototype.brunchPlugin = true;
EsprimaCompiler.prototype.type = 'javascript';
EsprimaCompiler.prototype.completer = true;
EsprimaCompiler.prototype.compile = function(params, callback) {
    if (this.validate) {
        try {
            var errors = esprima.parse(params.data, {
                tolerant: true
            }).errors;
            if (errors.length > 0) return callback(errors);
        } catch (error) {
            return callback(error);
        }
    }

    return callback(null, params);
};

module.exports = EsprimaCompiler;
