var logger = require('./logger')('http');

function HttpServer() {
}

HttpServer.prototype.start = function(port){
    var self = this;
    port = self.port = normalizePort(port);
    
    var http = require('http');     // NOTE delay require for testability
    var app = require('../app');    // NOTE delay require for testability
    app.set('port',port);

    var server = self.server = http.createServer(app);
    server.listen(port);

    server.on('listening',function onListening() {
        var addr = server.address();
        var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        logger.info('Listening on ' + bind);
    });

    server.on('error',function onError(error) {
        if (error.syscall !== 'listen') {
            logger.error('unexpected error: ' + error);
            throw error;
        }

        var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                logger.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                logger.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                logger.error('unknown error for ' + bind + ': ' + error);
                throw error;
        }
    });

    return server;
};

function normalizePort(value) {
    var port = parseInt(value,10);
    if (isNaN(port)) return value;  // named pipe
    if (port >= 0) return port;     // port number
    return false;
}

module.exports = new HttpServer();
