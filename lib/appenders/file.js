"use strict";

const layouts = require("log4js/lib/layouts");
const path = require("path");
const fs = require("fs");
const streams = require("log4js/lib/streams");
const os = require("os");
const eol = os.EOL || "\n";
const appenderList = [];
const stripAnsi = require("strip-ansi");
const hasProp = Object.prototype.hasOwnProperty;

//close open files on process exit.
process.on("exit", function() {
  appenderList.forEach(function(appender) {
    appender.destroy();
  });
});

/**
 * File Appender writing the logs to a text file. Supports rolling of logs by size.
 *
 * @param file file log messages will be written to
 * @param layout a function that takes a logevent and returns a string *   (defaults to basicLayout).
 * @param logSize - the maximum size (in bytes) for a log file, *   if not provided then logs won't be rotated.
 * @param numBackups - the number of log files to keep after logSize *   has been reached (default 5)
 * @param compress - flag that controls log file compression
 * @param timezoneOffset - optional timezone offset in minutes (default system local)
 * @param stripAnsi - flag that controls if ansi should be strip (default true)
 */
function fileAppender(config, layout) {
  const appender = new FileAppender(config, layout);

  // push file to the stack of open handlers
  appenderList.push(appender);

  return appender.write;
}

function FileAppender(config, layout) {
  this.file = path.normalize(config.filename);
  this.logSize = config.logSize;
  this.compress = config.compress;
  this.timezoneOffset = config.timezoneOffset;
  this.stripAnsi = hasProp.call(config, "stripAnsi") ? config.stripAnsi : true;
  this.numBackups = config.numBackups === undefined ? 5 : config.numBackups > config.numBackups ? config.numBackups : 1;
  this.layout = layout || layouts.basicLayout;
  this.getStream();

  if (this.stripAnsi) {
    this.write = this.stripAnsiWrite.bind(this);
  } else {
    this.write = this.write.bind(this);
  }
}

FileAppender.prototype.stripAnsiWrite = function(loggingEvent) {
  this.stream.write(stripAnsi(this.layout(loggingEvent, this.timezoneOffset)) + eol, "utf8");
};

FileAppender.prototype.write = function(loggingEvent) {
  this.stream.write(this.layout(loggingEvent, this.timezoneOffset) + eol, "utf8");
};

FileAppender.prototype.shutdown = function(done) {
  if ("function" !== typeof done) {
    done = Function.prototype;
  }

  const stream = this.stream;
  if (!stream.write(eol, "utf-8")) {
    stream.once("drain", function() {
      stream.end(done);
    });
  } else {
    stream.end(done);
  }
};

FileAppender.prototype.destroy = function(done) {
  if ("function" !== typeof done) {
    done = Function.prototype;
  }
  this.stream.end(done);
};

FileAppender.prototype.getStream = function() {
  if (this.stream) {
    return this.stream;
  }

  const file = this.file;
  let stream;

  if (this.fileSize) {
    stream = new streams.RollingFileStream(
      file,
      this.fileSize,
      this.numFiles, {
        "compress": this.compress
      }
    );
  } else {
    stream = fs.createWriteStream(
      file, {
        encoding: "utf8",
        mode: parseInt("0644", 8),
        flags: "a"
      }
    );
  }
  stream.on("error", function(err) {
    console.error("log4js.fileAppender - Writing to file %s, error happened ", file, err);
  });

  this.stream = stream;
  return stream;
};

function configure(config, options) {
  let layout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }
  if (options && options.cwd && !config.absolute) {
    config.filename = path.join(options.cwd, config.filename);
  }

  return fileAppender(config, layout);
}

function shutdown(cb) {
  let completed = 0;
  let error;
  const complete = function(err) {
    error = error || err;
    completed++;
    if (completed >= appenderList.length) {
      cb(error);
    }
  };
  if (!appenderList.length) {
    cb();
    return;
  }
  appenderList.forEach(function(appender) {
    appender.shutdown(complete);
  });
}

exports.FileAppender = FileAppender;
exports.appender = fileAppender;
exports.configure = configure;
exports.shutdown = shutdown;