const log4js = global.log4js || (global.log4js = require("log4js"));
const logger = log4js.getLogger("HttpServer");
const sysPath = require("path");
const fs = require("fs");

const CONTEXT = "/";

/**
 * Called by brunch
 * @param  {Integer}  port     port number to listen on
 * @param  {String}   path     public file path relative to project root
 * @param  {Function} callback to call when server is ready
 * @return {HttpServer}
 */
exports.startServer = function(port, path, callback) {
    path = sysPath.resolve(__dirname, "..", path);

    const express = require("express");
    const app = express();
    const context = CONTEXT;

    // prefer using nginx or httpd for static files
    // http://expressjs.com/en/starter/static-files.html
    app.use(context.substring(0, context.length - 1), express.static(path));

    // default page redirection
    if (context !== "/") {
        app.get("/", (req, res, next) => {
            res.redirect(301, context);
        });
    }

    app.get(`${ context }*`, (req, res, next) => {
        const url = req.path.substring(context.length);
        if (url === "") {
            sendContents(req, res, path, "classic", context);
        } else if (/^app\b/.test(url)) {
            sendContents(req, res, path, "single", context);
        } else if (/^web\b/.test(url)) {
            sendContents(req, res, path, "classic", context);
        } else {
            next();
        }
    });

    const server = require("http").createServer(app);

    server.listen(port, () => {
        logStatus(server);

        // prevent crash on uncaught exception
        process.on("uncaughtException", ex => {
            logger.error(`Exception: ${ ex.stack }`);
        });

        if ("function" === typeof callback) {
            callback();
        }
    });

    return server;
};

/**
 * Sends suitable page contents
 * @param  {HttpRequest}  req
 * @param  {HttpResponse} res
 * @param  {String}       path      absolute public file path
 * @param  {String}       context   context path
 */
function sendContents(req, res, path, page, context) {
    const filePath = sysPath.join(path, `index.${ page }.html`);
    fs.readFile(filePath, (err, contents) => {
        contents = contents.toString().replace(/\b(href|src|data-main)="(?!https?:\/\/|\/)([^"]+)/g, `$1="${ context }$2`);
        contents = contents.replace("baseUrl: ''", `baseUrl: '${ context }'`);
        res.send(contents);
    });
    return true;
}

/**
 * log server status
 * @param  {HttpServer} server
 */
function logStatus(server) {
    const listenedIface = server.address();
    logger.info("Server listening on", listenedIface);

    const {family, address} = listenedIface;

    if (address === "0.0.0.0" || address === "::") {
        const ifaces = require("os").networkInterfaces();

        // eslint-disable-next-line guard-for-in
        for (const iface in ifaces) {
            const len = ifaces[iface].length;

            for (let i = 0; i < len; i++) {
                const info = ifaces[iface][i];
                if (info.family === "IPv6" || info.family === family) {
                    logInfo(info, listenedIface);
                }
            }
        }
    } else {
        logInfo(listenedIface, listenedIface);
    }
}

function logInfo(info, listenedIface) {
    if (info.family === "IPv6") {
        logger.info(`http://[${ info.address }]:${ listenedIface.port }`);
    } else {
        logger.info(`http://${ info.address }:${ listenedIface.port }`);
    }
}
