var _ = require('lodash');
var logger = require('./../lib/logger')('socket');

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
    self.io = require('socket.io')(httpServer); // NOTE delay require for testability
    self.io.on('connection',function (socket) {
        socket.clientID = ++self.lastID;
        logger.info('connection(' + socket.clientID + ')');
        socket.emit('identified',{id: socket.clientID});
        socket.on('behavior',function(behavior){
            self.applyBehavior(behavior,socket);
        });
        socket.on('disconnect', function () {
            logger.info('disconnect(' + socket.clientID + ')');
            if (self.behavior && self.behavior.disconnectEvent) self.behavior.disconnectEvent(socket);
        });
        socket.on('close', function () {
            logger.info('close(' + socket.clientID + ')');
            if (self.behavior && self.behavior.closeEvent) self.behavior.closeEvent(socket);
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
    self.behavior = self.behaviors[type];
    _.each(self.behavior && self.behavior.eventHandlers ? self.behavior.eventHandlers : [],function(handler){
        socket.on(handler.event,function(data) {
            handler.callback(socket,data);
        });
    });
    socket.emit('behavior',{id: socket.clientID,result: !!self.behavior});
};

module.exports = SocketServer;