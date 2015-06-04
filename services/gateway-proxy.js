var _ = require('lodash');
var url = require('url');
var util = require('util');
var m2m = require('m2m-ota-javascript');

var Watcher = require('../lib/watcher');
var UdpListener = require('../lib/udp-listener');

var schema = require('../lib/redis-schema');
var logger = require('../lib/logger')('proxy');

function GatewayProxy(config) {
    this.https = require('https'); // delay for testing

    Watcher.apply(this,[logger,config,true]);
}

util.inherits(GatewayProxy,Watcher);

GatewayProxy.prototype._onStart = function(config,redis){
    var self = this;
    self.config = config;
    self.redis = redis;

    self.privateListener = new UdpListener('private',+self.config.privateRelay,function(message){ self.sendPrivate(message); });
    self.publicListener = new UdpListener('public',+self.config.publicRelay,function(message){ self.sendPublic(message); });

    self.outsideListener = new UdpListener('outside',null,function(buffer,info) {
        try {
            var message = new m2m.Message({buffer: buffer});
            switch (message.messageType) {
                case m2m.Common.MOBILE_TERMINATED_EVENT:
                case m2m.Common.MOBILE_ORIGINATED_EVENT:
                    self.routeCommand(message,info);
                    break;
                case m2m.Common.MOBILE_TERMINATED_ACK:
                case m2m.Common.MOBILE_ORIGINATED_ACK:
                    self.routeAck(message.sequenceNumber);
                    break;
                default:
                    logger.error('unexpected message type: ' + message.messageType);
            }
        } catch(e) {
            logger.error('enqueue error: ' + e.message);
        }
    });

    self.privateSender = self.makeSender(self.config.privateURL);
    self.publicSender = self.makeSender(self.config.publicURL);
};

GatewayProxy.prototype._onStop = function(){
    this.privateListener.close();
    this.privateListener = null;

    this.publicListener.close();
    this.publicListener = null;

    this.outsideListener.close();
    this.outsideListener = null;
};

GatewayProxy.prototype.sendPrivate = function(buffer,ignoreAckHint){
    var self = this;
    if (ignoreAckHint) self.ignoreAckHint = ignoreAckHint;
    var timestamp = new Date().valueOf();
    self.redis.mset(schema.transmit.lastTimestamp.key,timestamp,schema.transmit.lastPrivateTimestamp.key,timestamp).thenHint('sendPrivate',function(){
        self.privateSender.send(buffer);
        self.emit('send','private');
    });
};


GatewayProxy.prototype.sendPublic = function(buffer,ignoreAckHint){
    var self = this;
    if (ignoreAckHint) self.ignoreAckHint = ignoreAckHint;
    self.redis.set(schema.transmit.lastTimestamp.key,new Date().valueOf()).thenHint('sendPublic',function(){
        self.publicSender.send(buffer);
        self.emit('send','public');
    });
};

GatewayProxy.prototype.sendPrimary = function(buffer,ignoreAckHint){
    if (this.config.primary === 'private')
        this.sendPrivate(buffer,ignoreAckHint);
    else
        this.sendPublic(buffer,ignoreAckHint);
};

GatewayProxy.prototype.routeCommand = function(message,info){
    logger.info('enqueue command');
    var ackType = message.messageType == m2m.Common.MOBILE_ORIGINATED_EVENT ? m2m.Common.MOBILE_ORIGINATED_ACK : m2m.Common.MOBILE_TERMINATED_ACK;
    var ack = new m2m.Message({messageType: ackType,eventCode: message.eventCode,sequenceNumber: message.sequenceNumber}).pushString(0,this.config.imei);
    this.sendPrimary(ack.toWire(),false);
    this.redis.lpush(schema.command.queue.key,JSON.stringify(message)).errorHint('pushCommand');
};

GatewayProxy.prototype.routeAck = function(sequenceNumber){
    if (this.ignoreAckHint === sequenceNumber)
        logger.info('ignore ack: ' + sequenceNumber);
    else {
        logger.info('relay ack: ' + sequenceNumber);
        this.redis.lpush(schema.ack.queue.key,sequenceNumber).errorHint('pushAck');
    }
};

GatewayProxy.prototype.makeSender = function(urlString){
    var self = this;
    var urlParts = url.parse(urlString);
    var sender = {};
    switch(urlParts.protocol){
        case 'https:':
            sender.bodyParam = this.config.bodyParam || 'pistachio';
            sender.options = {
                hostname: urlParts.hostname,
                port: +urlParts.port || 443,
                path: urlParts.path,
                method: 'POST'
            };
            sender.send = _.bind(self.sendUsingHTTPS,self,_,sender.options,sender.bodyParam);
            break;
        case 'udp:':
            sender.hostname = urlParts.hostname;
            sender.port = +urlParts.port || 3011;
            sender.send = _.bind(self.outsideListener.send,self.outsideListener,_,sender.hostname,sender.port);
            break;
        default:
            logger.error('invalid protocol: ' + urlParts.protocol);
            // istanbul ignore next - if we detect the error, no further testing required
            sender.send = function(){};
            break;
    }
    return sender;
};

GatewayProxy.prototype.sendUsingHTTPS = function(buffer,options,param){
    var self = this;
    var req = self.https.request(options,function(res){
        if (res.statusCode === 200)
            self.routeAck(self.extractSequenceNumber(buffer));
        else
            logger.error('http error status: ' + res.statusCode);
    });
    req.on('error',function(error){
        logger.error('https error: ' + error);
    });

    try{
        var base64 = new Buffer(buffer).toString('base64');
        logger.info('outgoing http: ' + base64);
        req.write(param + '=' + base64);
        req.end();
    } catch(e){
        // istanbul ignore next - prophylactic error handling should not be reached
        logger.error('https send error: ' + e.message);
    }
};

GatewayProxy.prototype.extractSequenceNumber = function(buffer){
    try{
        var message = new m2m.Message({buffer: buffer});
        return message.sequenceNumber;
    } catch(e){
        logger.warn('sequence number failure: ' + e.message);
        return 0;
    }
};

module.exports = GatewayProxy;
