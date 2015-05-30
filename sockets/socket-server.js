var _ = require('lodash');

var session = require('../lib/session');
var logger = require('../lib/logger')('socket');

function SocketServer(){
    this.behaviors = {};
}

SocketServer.prototype.started = function(){
    return !!this.httpServer;
};

SocketServer.prototype.start = function (httpServer) {
    var self = this;
    self.httpServer = httpServer;
    self.lastID = 0;
    self.ioServer = require('socket.io')(httpServer,{path: '/supervisor/socket'}); // NOTE delay require for testability
    self.ioServer.use(function(socket, next) {
        session(socket.handshake, {}, next);
    });
    self.ioServer.on('connection',function (socket) {
        var proxy = socket.handshake.session.proxy;
        if (proxy) {
            if (!self.ioClient) self.ioClient = require('socket.io-client'); // NOTE delay for testability et.al
            socket.proxySocket = self.ioClient(proxy.hostname + ':' + 5000,{path: '/supervisor/socket'}); // TODO make port configurable?
            socket.proxySocket.on('identified',function(data){
                console.log('proxy identified: ' + JSON.stringify(data));
            });
            socket.proxySocket.on('close',function(data){
                console.log('proxy close: ' + JSON.stringify(data));
            });
            socket.proxySocket.on('connect',function(){
                console.log('proxy connect');
            });
            socket.proxySocket.on('disconnect',function(){
                console.log('proxy disconnect');
            });
            socket.proxySocket.on('error',function(error){
                console.log('proxy error:' + error);
            });
            socket.proxySocket.on('reconnect',function(number){
                console.log('proxy reconnect:' + number);
            });
            socket.proxySocket.on('reconnect_attempt',function(){
                console.log('proxy reconnect_attempt');
            });
            socket.proxySocket.on('reconnecting',function(number){
                console.log('proxy reconnecting:' + number);
            });
            socket.proxySocket.on('reconnect_failed',function(){
                console.log('proxy reconnect_failed');
            });

            socket.proxySocket.on('behavior',function(data){
                console.log('proxy behavior:' + JSON.stringify(data));
                _.each(data.emissions,function(event){
                    if (socket.proxySocket.listeners(event).length === 0) socket.proxySocket.on(event,function(event,data){ socket.emit(event,data); });
                })
            });
        }

        socket.behaviors = {};
        socket.clientID = ++self.lastID;
        logger.info('connection(' + socket.clientID + ')');
        socket.emit('identified',{id: socket.clientID});
        socket.on('behavior',function(behavior){
            if (socket.proxySocket) socket.proxySocket.emit('behavior',behavior);
            self.applyBehavior(behavior,socket);
        });
        socket.on('disconnect', function () {
            logger.info('disconnect(' + socket.clientID + ')');
            if (socket.proxySocket) socket.proxySocket.disconnect();
            _.each(socket.behaviors,function(behavior) { behavior && behavior.disconnectEvent && behavior.disconnectEvent(socket); })
        });
        socket.on('close', function () {
            logger.info('close(' + socket.clientID + ')');
            if (socket.proxySocket) socket.proxySocket.close();
            _.each(socket.behaviors,function(behavior) { behavior && behavior.closeEvent && behavior.closeEvent(socket); })
        });
    });
    return this;
};

SocketServer.prototype.registerBehavior = function(type,behavior){
    if (this.behaviors[type]) throw(new Error('behavior already registered: ' + type));
    logger.info('register behavior: ' + type);
    this.behaviors[type] = behavior;
    return this;
};

SocketServer.prototype.applyBehavior = function(type,socket) {
    logger.info('behavior(' + socket.clientID + '): ' + type);

    var self = this;
    var behavior = null;
    if (!socket.behaviors[type]) {
        behavior = self.behaviors[type];
        socket.behaviors[type] = behavior;
        _.each((behavior && behavior.eventHandlers) || [],function(handler){
            if (socket.proxySocket)
                socket.on(handler.event,function(data){ socket.proxySocket.emit(handler.event,data) });
            else
                socket.on(handler.event,function(data) { handler.callback(socket,data); });
        });
    }
    socket.emit('behavior',{id: socket.clientID,result: !!behavior,emissions: (behavior && behavior.emissions) || []});
};

module.exports = SocketServer;