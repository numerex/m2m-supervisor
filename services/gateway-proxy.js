var util = require('util');
var m2m = require('m2m-ota-javascript');

var Watcher = require('../lib/watcher');
var UdpListener = require('../lib/udp-listener');

var schema = require('../lib/redis-schema');
var logger = require('../lib/logger')('proxy');

function GatewayProxy(config) {
    Watcher.apply(this,[logger,config,true]);
}

util.inherits(GatewayProxy,Watcher);

GatewayProxy.prototype._onStart = function(config,redis){
    var self = this;
    self.config = config;
    self.redis = redis;

    self.private = new UdpListener('private',+self.config.privateRelay,function(message){ self.sendPrivate(message); });
    self.public = new UdpListener('public',+self.config.publicRelay,function(message){ self.sendPublic(message); });
    self.outside = new UdpListener('outside',null,function(buffer) {
        try {
            var message = new m2m.Message({buffer: buffer});
            switch (message.messageType) {
                case m2m.Common.MOBILE_TERMINATED_EVENT:
                    // TODO send ack now?
                    logger.info('enqueue command');
                    self.redis.lpush(schema.command.queue.key,JSON.stringify(message));
                    break;
                case m2m.Common.MOBILE_TERMINATED_ACK:
                    if (self.ignoreAckHint === message.sequenceNumber)
                        logger.info('ignore ack: ' + message.sequenceNumber);
                    else {
                        logger.info('relay ack: ' + message.sequenceNumber);
                        self.redis.lpush(schema.ack.queue.key,message.sequenceNumber);
                    }
                    break;
                default:
                    logger.error('unexpected message type: ' + message.messageType);
            }
        } catch(e) {
            logger.error('enqueue error: ' + e);
        }
    });
};

GatewayProxy.prototype._onStop = function(){
    this.private.close();
    this.private = null;

    this.public.close();
    this.public = null;

    this.outside.close();
    this.outside = null;
};

GatewayProxy.prototype.sendPrivate = function(buffer,ignoreAckHint){
    var self = this;
    if (ignoreAckHint) self.ignoreAckHint = ignoreAckHint;
    var timestamp = new Date().valueOf();
    self.redis.mset(schema.transmit.lastTimestamp.key,timestamp,schema.transmit.lastPrivateTimestamp.key,timestamp).then(function(){
        self.outside.send(buffer,self.config.privateHost,+self.config.privatePort);
        self.emit('send','private');
    });
};


GatewayProxy.prototype.sendPublic = function(buffer,ignoreAckHint){
    var self = this;
    if (ignoreAckHint) self.ignoreAckHint = ignoreAckHint;
    self.redis.set(schema.transmit.lastTimestamp.key,new Date().valueOf()).then(function(){
        self.outside.send(buffer,self.config.publicHost,+self.config.publicPort);
        self.emit('send','public');
    });
};

GatewayProxy.prototype.sendPrimary = function(buffer,ignoreAckHint){
    var self = this;
    if (self.config.primary == 'private')
        self.sendPrivate(buffer,ignoreAckHint);
    else
        self.sendPublic(buffer,ignoreAckHint);
};

module.exports = GatewayProxy;
