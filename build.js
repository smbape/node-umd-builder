
const fs = require("fs");
const sysPath = require("path");
const {explore} = require("fs-explorer");
const {quoteArg} = require("anyspawn");
const log4js = require("./log4js");
const logger = log4js.getLogger("umd-builder");
const resolveFrom = require("./utils/resolveFrom");
require("./utils/fcache");

fs.ReadStream.prototype.open = function() {
    const self = this;
    const stack = (new Error()).stack;
    fs.open(this.path, this.flags, this.mode, (er, fd) => {
        if (er) {
            if (self.autoClose) {
                self.destroy();
            }
            er.stack = `${ er.stack + (new Error()).stack }\n${ stack }`;
            self.emit("error", er);
            return;
        }

        self.fd = fd;
        self.emit("open", fd);
        // start the flow of data.
        self.read();
    });
};

const cli = require("brunch/lib/cli");
const program = require(resolveFrom("brunch", "commander"));

program.commands.forEach(command => {
    if (command._name === "build" || command._name === "watch") {
        command.option("--clean", "empty public directory before starting");
        command.option("-f, --force", "force clean without prompt");
    }
});

const command = process.argv[2];

let cleanOpt, forceOpt;
if (/^w|watch|b|build|bb|bbp|bw|bws$/.test(command)) {
    process.argv.slice(2).forEach(arg => {
        if (arg === "--clean") {
            cleanOpt = true;
        }
        if (arg === "--force" || /^-\w/.test(arg) && arg.indexOf("f") !== -1) {
            forceOpt = true;
        }
    });
}

if (cleanOpt) {
    clean(run);
} else {
    run();
}

function run() {
    cli.run();
}

function clean(next) {
    // TODO: take plublic path from config
    const PUBLIC_PATH = sysPath.resolve("public");

    const prompt = require("prompt");
    if (forceOpt) {
        prompt.override = {
            answer: "yes"
        };
    }
    prompt.colors = false;
    prompt.message = "";
    prompt.delimiter = "";
    prompt.start();

    prompt.get({
        properties: {
            answer: {
                description: `Confirm cleaning of ${ quoteArg(PUBLIC_PATH) }? [yes/no]: `
            }
        }
    }, (err, result) => {
        if (result && /^yes$/i.test(result.answer)) {
            logger.warn(`cleaning folder ${ quoteArg(PUBLIC_PATH) }`);

            remove(PUBLIC_PATH, {
                empty: true
            }, err => {
                logger.warn(`cleaned ${ quoteArg(PUBLIC_PATH) }`);
                if (err && err.code !== "ENOENT") {
                    logger.error(err);
                }
                next();
            });
        } else {
            next();
        }
    });
}

/**
 * rm -rf. Symlink are not resolved by default, avoiding unwanted deep deletion
 * there should be a way to do it with rimraf, but too much options digging to find a way to do it
 * @param  {String}   file or folder to remove
 * @param  {Function} done called on end
 */
function remove(file, options, done) {
    if (arguments.length === 2 && "function" === typeof options) {
        done = options;
        options = {};
    }

    if (typeof done !== "function") {
        done = Function.prototype;
    }

    function callfile(file_, stats, done) {
        fs.unlink(file_, done);
    }

    function calldir(dir, stats, files, state, done) {
        if (state === "end") {
            if (options.empty && dir === file) {
                done();
            } else if (stats.isSymbolicLink()) {
                    fs.unlink(dir, done);
                } else {
                    fs.rmdir(dir, er => {
                        if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")) {
                            // try in few time, last deletion is not completely ended
                            setTimeout(() => {
                                fs.rmdir(dir, done);
                            }, 10);
                        } else {
                            done(er);
                        }
                    });
                }
        } else {
            done();
        }
    }

    explore(file, callfile, calldir, Object.assign({
        resolve: true,
        followSymlink: false
    }, options), done);
}
