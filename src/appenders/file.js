"use strict";

var layouts = require('log4js/lib/layouts'),
  path = require('path'),
  fs = require('fs'),
  streams = require('log4js/lib/streams'),
  os = require('os'),
  eol = os.EOL || '\n',
  appenderList = [],
  levels = require('log4js/lib/levels'),
  stripAnsi = require('strip-ansi');

//close open files on process exit.
process.on('exit', function() {
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
  var appender = new FileAppender(config, layout);

  // push file to the stack of open handlers
  appenderList.push(appender);

  return appender.write;
}

function FileAppender(config, layout) {
  this.file = path.normalize(config.filename);
  this.logSize = config.logSize;
  this.compress = config.compress;
  this.timezoneOffset = config.timezoneOffset;
  this.stripAnsi = config.hasOwnProperty('stripAnsi') ? config.stripAnsi : true;
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
  if ('function' !== typeof done) {
    done = function() {};
  }

  var stream = this.stream;
  if (!stream.write(eol, "utf-8")) {
    stream.once('drain', function() {
      stream.end(done);
    });
  } else {
    stream.end(done);
  }
};

FileAppender.prototype.destroy = function(done) {
  if ('function' !== typeof done) {
    done = function() {};
  }
  this.sream.end(done);
};

FileAppender.prototype.getStream = function() {
  if (this.stream) {
    return this.stream;
  }

  var file = this.file,
    stream;

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
        mode: parseInt('0644', 8),
        flags: 'a'
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
  var layout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }
  if (options && options.cwd && !config.absolute) {
    config.filename = path.join(options.cwd, config.filename);
  }

  return fileAppender(config, layout);
}

function shutdown(cb) {
  var completed = 0;
  var error;
  var complete = function(err) {
    error = error || err;
    completed++;
    if (completed >= appenderList.length) {
      cb(error);
    }
  };
  if (!appenderList.length) {
    return cb();
  }
  appenderList.forEach(function(appender) {
    appender.shutdown(complete);
  });
}

exports.FileAppender = FileAppender;
exports.appender = fileAppender;
exports.configure = configure;
exports.shutdown = shutdown;