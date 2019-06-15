"use strict";
var sysPath;

// log4js = require "../log4js"
// logger = log4js.getLogger "umd-builder"
sysPath = require("path");

exports.generateConfig = function(options) {
  var APPLICATION_PATH, BOWER_COMPONENTS_ABSOLUTE_PATH, BOWER_COMPONENTS_RELATIVE_PATH, BOWER_COMPONENTS_URL, BOWER_PUBLIC_PATH, CLIENT_ASSETS_PATH, CLIENT_ASSETS_RELATIVE_PATH, CLIENT_MODULES_PATH, CLIENT_MODULES_URL, CLIENT_PATH, CLIENT_RELATIVE_PATH, PUBLIC_PATH, config;
  config = {};
  APPLICATION_PATH = sysPath.resolve(options.paths.root);
  CLIENT_RELATIVE_PATH = options.paths.watched[0];
  // Where to find client files
  CLIENT_PATH = sysPath.join(APPLICATION_PATH, CLIENT_RELATIVE_PATH);
  // where to find index.hbs
  CLIENT_ASSETS_PATH = sysPath.join(CLIENT_PATH, "assets");
  CLIENT_ASSETS_RELATIVE_PATH = sysPath.relative(CLIENT_PATH, CLIENT_ASSETS_PATH);
  BOWER_COMPONENTS_RELATIVE_PATH = "bower_components";
  PUBLIC_PATH = sysPath.resolve(APPLICATION_PATH, options.paths.public);
  // where to copy non asset files
  CLIENT_MODULES_URL = options.paths.modules || "node_modules";
  CLIENT_MODULES_PATH = sysPath.join(PUBLIC_PATH, CLIENT_MODULES_URL);
  // where to copy bower files
  BOWER_PUBLIC_PATH = sysPath.join(PUBLIC_PATH, BOWER_COMPONENTS_RELATIVE_PATH);
  BOWER_COMPONENTS_ABSOLUTE_PATH = sysPath.join(APPLICATION_PATH, BOWER_COMPONENTS_RELATIVE_PATH);
  // Bower relative path to be used by require.js for path resolution
  BOWER_COMPONENTS_URL = sysPath.relative(CLIENT_MODULES_PATH, BOWER_PUBLIC_PATH).replace(/[\\]/g, "/");
  config.paths = {APPLICATION_PATH, CLIENT_RELATIVE_PATH, CLIENT_PATH, CLIENT_ASSETS_PATH, CLIENT_ASSETS_RELATIVE_PATH, BOWER_COMPONENTS_ABSOLUTE_PATH, BOWER_COMPONENTS_RELATIVE_PATH, PUBLIC_PATH, CLIENT_MODULES_URL, CLIENT_MODULES_PATH, BOWER_PUBLIC_PATH, BOWER_COMPONENTS_URL};
  return config;
};
