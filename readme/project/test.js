// depsLoader is needed to deal with specific environment dependencies
// i.e. {amd: 'this', common: '!that', node: 'another'}
global.depsLoader = require('./public/vendor/depsLoader');

var lib = require('./public/node_modules/examples/some-module');
console.log(lib);