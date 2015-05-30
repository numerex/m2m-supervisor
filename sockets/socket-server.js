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
            socket.emit('ready',null);

        socket.on('behavior',function(behavior){
            self.applyBehavior(behavior,socket);
            if (socket.proxySocket) socket.proxySocket.emit('behavior',behavior);
        });
        socket.on('disconnect', function () {
            logger.info('disconnect(' + socket.clientID + ')');
            _.each(socket.behaviors,function(behavior) { behavior && behavior.disconnectEvent && behavior.disconnectEvent(socket); });
            if (socket.proxySocket === socket) socket.proxySocket.relaySocket = null;
        });
        socket.on('close', function () {
            logger.info('close(' + socket.clientID + ')');
            _.each(socket.behaviors,function(behavior) { behavior && behavior.closeEvent && behavior.closeEvent(socket); });
            if (socket.proxySocket === socket) socket.proxySocket.relaySocket = null;
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
        var proxySocket = socket.proxySocket;
        if (!proxySocket)
            _.each((behavior && behavior.eventHandlers) || [],function(handler){
                socket.on(handler.event,function(data) { handler.callback(socket,data); });
            });
        else{
            _.each((behavior && behavior.eventHandlers) || [],function(handler){
                socket.on(handler.event,function(data){
                    console.log('proxy incoming event:' + handler.event + ' ' + JSON.stringify(data));
                    proxySocket.emit(handler.event,data)
                });
            });
            _.each(behavior && behavior.emissions || [],function(event){
                if (proxySocket.listeners(event).length === 0)
                    proxySocket.on(event,function(data){
                        console.log('proxy outgoing event:' + event + ' ' + JSON.stringify(data));
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
            socket.emit('busy',null);
        else {
            proxySocket.relaySocket = socket;
            socket.emit('ready',null);
        }
    } else {
        proxySocket = self.proxies[proxy.hostname] = self.ioClient('http://' + proxy.hostname + ':' + 5000,{path: '/supervisor/socket'}); // TODO make port configurable?
        proxySocket.relaySocket = socket;
        proxySocket.on('identified',function(data){
            console.log('proxy identified: ' + JSON.stringify(data));
        });
        proxySocket.on('close',function(data){
            console.log('proxy close: ' + JSON.stringify(data));
        });
        proxySocket.on('connect',function(){
            console.log('proxy connect');
            proxySocket.relaySocket.emit('ready',null);
        });
        proxySocket.on('disconnect',function(){
            console.log('proxy disconnect');
        });
        proxySocket.on('error',function(error){
            console.log('proxy error:' + error);
        });
        proxySocket.on('reconnect',function(number){
            console.log('proxy reconnect:' + number);
        });
        proxySocket.on('reconnect_attempt',function(){
            console.log('proxy reconnect_attempt');
        });
        proxySocket.on('reconnecting',function(number){
            console.log('proxy reconnecting:' + number);
        });
        proxySocket.on('reconnect_failed',function(){
            console.log('proxy reconnect_failed');
        });

        proxySocket.on('behavior',function(data){
            console.log('proxy behavior:' + JSON.stringify(data));
        });
    }
    return proxySocket;
};

module.exports = SocketServer;