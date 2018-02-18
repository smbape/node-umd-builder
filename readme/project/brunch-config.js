const merge = require("lodash/merge");

// get a preconfigured config
const {matcher, config} = require('umd-builder/lib/brunch-config');

const includedVendors = ['bower_components/', 'vendor/'];
const excludedVendors = ['vendor/path.js$', 'vendor/require.js$'];
const ignore = (path) => config.conventions.vendor(path)

// http://brunch.io/docs/config
// extend preconfigured config
exports.config = merge(config, {

    compilers: [
        require('umd-builder/lib/compilers/babel'), // Needed for jsx interpretation
        require('umd-builder/lib/compilers/amd'), // Mandatory. Transform files with a top level factory or freact function in umd modules
        require('umd-builder/lib/compilers/copy'), // Recommended. copy all watched files that do not match a javascript or stylesheet compiler
        require('umd-builder/lib/compilers/relativecss'), // Recommended. keep correct path in css. ex: bootstrap
        require('umd-builder/lib/compilers/html'), // Transform html in umd modules
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
            ignore: ignore
        },
        eslint: {
            // ignore lint for vendor files
            ignore: ignore
        },
    },

    server: {
        path: './server/HttpServer', // path to server
        hostname: '127.0.0.1', // server hostname
        port: 3330, // server port
    },

    files: {
        javascripts: {
            joinTo: {
                // join vendor files to vendor.js except path-browserify.js, depsLoader.js, require.js
                'javascripts/vendor.js': matcher(includedVendors, excludedVendors)
            }
        }
    }
});
