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
        socket.behaviors = {};
        socket.clientID = ++self.lastID;
        logger.info('connection(' + socket.clientID + ')');
        socket.emit('identified',{id: socket.clientID});

        var proxy = socket.handshake.session.proxy;
        if (proxy)
            socket.proxySocket = self.findProxySocket(proxy,socket);
        else
            socket.emit('ready',{id: socket.clientID});

        socket.on('behavior',function(behavior){
            self.applyBehavior(behavior,socket);
            if (socket.proxySocket) socket.proxySocket.emit('behavior',behavior);
        });
        socket.on('disconnect', function () {
            logger.info('disconnect(' + socket.clientID + ')');
            _.each(socket.behaviors,function(behavior) { behavior && behavior.disconnectEvent && behavior.disconnectEvent(socket); });
            self.resetRelaySocket(socket);
        });
        socket.on('close', function () {
            logger.info('close(' + socket.clientID + ')');
            _.each(socket.behaviors,function(behavior) { behavior && behavior.closeEvent && behavior.closeEvent(socket); });
            self.resetRelaySocket(socket);
        });
    });
    return this;
};

SocketServer.prototype.resetRelaySocket = function(socket){
    if (socket.proxySocket && socket.proxySocket.relaySocket === socket) socket.proxySocket.relaySocket = null;
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
        var proxySocket = socket.proxySocket;
        if (!proxySocket)
            _.each(behavior.eventHandlers,function(handler){
                socket.on(handler.event,function(data) { handler.callback(socket,data); });
            });
        else{
            _.each(behavior.eventHandlers,function(handler){
                socket.on(handler.event,function(data){
                    logger.info('proxy incoming event: ' + handler.event + ' ' + JSON.stringify(data));
                    proxySocket.emit(handler.event,data)
                });
            });
            _.each(behavior.emissions,function(event){
                if (proxySocket.listeners(event).length === 0)
                    proxySocket.on(event,function(data){
                        logger.info('proxy outgoing event: ' + event + ' ' + JSON.stringify(data));
                        proxySocket.relaySocket.emit(event,data);
                    });
            })
        }
    }
    socket.emit('behavior',{id: socket.clientID,result: !!behavior,emissions: (behavior && behavior.emissions) || []});
};

SocketServer.prototype.findProxySocket = function(proxy,socket){
    var self = this;
    if (!self.ioClient) self.ioClient = require('socket.io-client'); // NOTE delay for testability et.al
    if (!self.proxies) self.proxies = {};
    var proxySocket = self.proxies[proxy.hostname];
    if (proxySocket){
        if (proxySocket.relaySocket)
            socket.emit('busy',{id: socket.clientID});
        else {
            proxySocket.relaySocket = socket;
            socket.emit('ready',{id: socket.clientID});
        }
    } else {
        proxySocket = self.proxies[proxy.hostname] = self.ioClient('http://' + proxy.hostname + ':' + 5000,{path: '/supervisor/socket'}); // TODO make port configurable?
        proxySocket.relaySocket = socket;
        proxySocket.on('connect',function(){
            if (!proxySocket.relaySocket)
                logger.info('proxy connect - ignored');
            else {
                logger.info('proxy connect - relayed');
                proxySocket.relaySocket.emit('ready',{id: proxySocket.relaySocket.clientID});
            }
        });
        proxySocket.on('close',function(){
            logger.info('proxy close');
        });
        proxySocket.on('disconnect',function(){
            logger.info('proxy disconnect');
        });
        proxySocket.on('error',function(error){
            logger.info('proxy error: ' + error.message);
        });
        proxySocket.on('reconnect',function(number){
            logger.info('proxy reconnect: ' + number);
        });
        proxySocket.on('reconnect_attempt',function(){
            logger.info('proxy reconnect_attempt');
        });
        proxySocket.on('reconnecting',function(number){
            logger.info('proxy reconnecting: ' + number);
        });
        proxySocket.on('reconnect_failed',function(){
            logger.info('proxy reconnect_failed');
        });

        proxySocket.on('identified',function(data){
            logger.info('proxy identified: ' + JSON.stringify(data));
        });
        proxySocket.on('behavior',function(data){
            logger.info('proxy behavior: ' + JSON.stringify(data));
        });
    }
    return proxySocket;
};

module.exports = SocketServer;