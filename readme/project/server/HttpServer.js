var log4js = global.log4js || (global.log4js = require('log4js')),
    logger = log4js.getLogger('HttpServer'),
    sysPath = require('path'),
    fs = require('fs'),
    context = '/';

/**
 * Called by brunch
 * @param  {Integer}  port     port number to listen on
 * @param  {String}   path     public file path relative to project root
 * @param  {Function} callback to call when server is ready
 * @return {HttpServer}
 */
exports.startServer = function(port, path, callback) {
    path = sysPath.resolve(__dirname, '..', path);

    var express = require('express'),
        app = express();

    // prefer using nginx or httpd for static files
    // http://expressjs.com/en/starter/static-files.html
    app.use(context.substring(0, context.length - 1), express.static(path));

    // default page redirection
    if (context !== '/') {
        app.get('/', function(req, res, next) {
            res.redirect(301, context);
        });
    }

    app.get(context + '*', function(req, res, next) {
        var url = req.path.substring(context.length);
        if (url === '') {
            sendContents(req, res, path, 'classic', context);
        } else if (/^app\b/.test(url)) {
            sendContents(req, res, path, 'single', context);
        } else if (/^web\b/.test(url)) {
            sendContents(req, res, path, 'classic', context);
        } else {
            next();
        }
    });

    server = require('http').createServer(app);

    server.listen(port, function() {
        logStatus(server);

        // prevent crash on uncaught exception
        process.on('uncaughtException', function(ex) {
            logger.error("Exception: " + ex.stack);
        });

        if ('function' === typeof callback) {
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
    var filePath;
    filePath = sysPath.join(path, 'index.' + page + '.html');
    fs.readFile(filePath, function(err, contents) {
        contents = contents.toString().replace(/\b(href|src|data-main)="(?!https?:\/\/|\/)([^"]+)/g, "$1=\"" + context + "$2");
        contents = contents.replace("baseUrl: ''", "baseUrl: '" + context + "'");
        res.send(contents);
    });
    return true;
}

/**
 * log server status
 * @param  {HttpServer} server
 */
function logStatus(server) {
    var i, iface, ifaces, info, len, listenedIface, ref, ref1;
    listenedIface = server.address();
    logger.info('Server listening on', listenedIface);
    if ((ref = listenedIface.address) === '0.0.0.0' || ref === '::') {
        ifaces = require('os').networkInterfaces();
        for (iface in ifaces) {
            ref1 = ifaces[iface];
            for (i = 0, len = ref1.length; i < len; i++) {
                info = ref1[i];
                if (info.family === 'IPv6' || info.family === listenedIface.family) {
                    log(info, listenedIface);
                }
            }
        }
    } else {
        log(listenedIface, listenedIface);
    }

    function log(info, listenedIface) {
        if (info.family === 'IPv6') {
            logger.info('http://[' + info.address + ']:' + listenedIface.port);
        } else {
            logger.info('http://' + info.address + ':' + listenedIface.port);
        }
    }
}