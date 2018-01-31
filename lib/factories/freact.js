const freact = function(plugin, modulePath, data, parsed) {
    const [, , args, head, declaration, _body] = parsed;

    const body = declaration + args.join(", ") + _body;

    return `
    ${head}
    deps.unshift({amd: 'react', common: '!React'}, {amd: 'react-dom', common: '!ReactDOM'});
    
    function factory(require, React, ReactDOM) {
        /*jshint validthis: true */

        ${declaration}${args.join(", ")}${body}

        // eslint-disable-next-line no-invalid-this
        return freact.apply(this, Array.prototype.slice.call(arguments, 3));
    }`.replace(/^ {4}/mg, "").trim();
};

module.exports = factories => {
    factories.freact = freact;

    return factories;
};
