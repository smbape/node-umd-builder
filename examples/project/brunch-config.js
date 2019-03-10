const merge = require("lodash/merge");
const anymatch = require("anymatch");

// get a preconfigured config
const {matcher, config} = require('umd-builder/lib/brunch-config');

const matchVendor = anymatch(config.conventions.vendor);

// http://brunch.io/docs/config
// extend preconfigured config
exports.config = merge(config, {

    compilers: [
        require('umd-builder/lib/compilers/babel'), // Needed for ESnext transpilation
        require('umd-builder/lib/compilers/amd'),   // Mandatory. Creates amd files
        require('umd-builder/lib/compilers/copy'),  // Recommended. copy all watched files that do not match a javascript or stylesheet compiler
        require('umd-builder/lib/compilers/relativecss'), // Recommended. Fix relative css url paths. Works with copy compiler.
        require('umd-builder/lib/compilers/html'),  // Transform html files into javascript modules
    ],

    // http://requirejs.org/docs/api.html
    requirejs: {
        map: {
            // http://requirejs.org/docs/api.html//config-map
            '*': {
                underscore: 'lodash' // in AMD mode, use lodash libray instead of underscore library
            }
        }
    },

    plugins: {
        amd: {
            // lint amd files
            eslint: true
        },
        babel: {
            // ignore babel transformation for vendor files
            ignore: matchVendor
        },
        eslint: {
            // ignore lint for vendor files
            ignore: matchVendor,

            // overrides some linting rules (ES6) for brunch generated files
            overrides: {
                "*": {
                    rules: {
                        "arrow-parens": 0,
                        "arrow-spacing": 0,
                        "no-class-assign": 0,
                        "no-confusing-arrow": 0,
                        "no-const-assign": 0,
                        "no-dupe-class-members": 0,
                        "no-duplicate-imports": 0,
                        "no-new-symbol": 0,
                        "no-useless-computed-key": 0,
                        "no-useless-constructor": 0,
                        "no-useless-rename": 0,
                        "no-var": 0,
                        "no-void": 0,
                        "object-shorthand": 0,
                        "prefer-arrow-callback": 0,
                        "prefer-const": 0,
                        "prefer-numeric-literals": 0,
                        "prefer-spread": 0,
                        "prefer-template": 0,
                        "require-yield": 0,
                        "rest-spread-spacing": 0,
                        "sort-imports": 0,
                        "symbol-description": 0,
                        "template-curly-spacing": 0,
                        "yield-star-spacing": 0
                    }
                }
            }
        },
        html: {
            // transform html in commonjs modules then babel compiler will transform them in umd modules
            type: "common"
        }
    },

    server: {
        path: './server/HttpServer',
        hostname: '127.0.0.1',
        port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : 3330
    }
});
