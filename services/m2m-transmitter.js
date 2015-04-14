var _ = require('lodash');
var m2m = require('m2m-ota-javascript');

var UdpListener = require('../lib/udp-listener');

var logger = require('./../lib/logger')('transmit');
var schema = require('./../lib/redis-schema');
var settings = require('./../lib/m2m-settings');

function M2mTransmitter(gateway,config) {
    var self = this;
    self.gateway = gateway;
    self.config = _.defaults(config || {},{
        idleReport:         60 / 5,
        maxRetries:         5,
        timeoutInterval:    5
    });
    self.stats = require('./../lib/statsd-client')('transmit');    // NOTE - delay require for mockery testing
    self.redis = require('redis').createClient();           // NOTE - delay require for mockery testing
    self.client = new UdpListener('transmit',null,function(buffer) { console.log(buffer); });
}

M2mTransmitter.prototype.started = function(){
    return !!this.startCalled;
};

M2mTransmitter.prototype.ready = function(){
    return !!this.gateway;
};

M2mTransmitter.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start transmitter');

    var self = this;
    self.idleCount = 0;
    self.startCalled = true;
    self.noteEvent = note || function(){};
    self.redisLogErrorCallback = function(err,value){ self.redisLogError(err,value) };
    self.checkQueueCallback = function(){ self.checkQueue(); };
    self.asyncCheckQueue();
    self.stats.increment('started');
    self.noteEvent('ready');
    return self;
};

M2mTransmitter.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop transmitter');
    this.stats.increment('stopped');
    this.startCalled = false;
};

M2mTransmitter.prototype.checkQueue = function(){
    if (!this.ready()) return;

    var self = this;
    self.redis.mget(schema.ack.message.key,schema.ack.retries.key,schema.ack.sequenceNumber.key,_.bind(self.redisCheckResult,self,_,_,function(values){
        var message = values[0];
        var retries = values[1] || '0';
        var ackSequenceNumber = values[2] || '0';
        if (message)
            self.redis.brpop(schema.ack.queue.key,self.config.timeoutInterval,_.bind(self.redisCheckResult,self,_,_,function(result){
                if (result && result[0] == schema.ack.queue.key && +result[1] === +ackSequenceNumber) {
                    logger.info('acked: ' + ackSequenceNumber);
                    self.redis.del(schema.ack.message.key,schema.ack.retries.key,schema.ack.sequenceNumber.key,self.redisLogErrorCallback);
                    self.stats.increment('acks');
                    self.noteEvent('ack');
                } else if (+retries > self.config.maxRetries) {
                    logger.error('too many retries: ' + message);
                    self.redis.del(schema.ack.message.key,schema.ack.retries.key,self.redisLogErrorCallback);
                    self.stats.increment('error');
                    self.noteEvent('error');
                } else {
                    logger.info('retry: ' + ackSequenceNumber);
                    self.stats.increment('retries');
                    self.redis.incr(schema.ack.retries.key,self.redisLogErrorCallback);
                    self.transmitMessage(new m2m.Message({json: message}));
                }
                self.asyncCheckQueue();
            }));
        else
            self.redis.brpop(schema.ack.queue.key,schema.transmit.queue.key,self.config.timeoutInterval,_.bind(self.redisCheckResult,self,_,_,function(result){
                if (!result)
                    (++self.idleCount % self.idleReport == 0) && logger.info('idle: ' + self.idleCount);
                else if (result[0] !== schema.transmit.queue.key)
                    logger.warn('ignoring queue entry: ' + result);
                else {
                    var attributes = self.safeParseJSON(result[1]);
                    if (!attributes)
                        self.noteEvent('error');
                    else {
                        self.generateMessage(attributes);
                        return; // NOTE - prevent drop-through to "asyncCheckQueue" call
                    }
                }
                self.asyncCheckQueue();
            }));
    }));
};

M2mTransmitter.prototype.generateMessage = function(attributes) {
    var eventCode = attributes.eventCode || settings.EventCodes.heartbeat;
    delete attributes.eventCode;

    var timestamp = attributes.timestamp;
    delete attributes.timestamp;

    var sequenceNumber = attributes.sequenceNumber;
    delete attributes.sequenceNumber;
    
    var self = this;
    self.redis.incr(schema.transmit.lastSequenceNumber.key,_.bind(self.redisCheckResult,self,_,_,function(newSequenceNumber){
        var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: sequenceNumber || newSequenceNumber,timestamp: timestamp})
            .pushString(0,self.gateway.imei);
        for (var key in attributes) {
            var code = +key;
            if (code > 0)
                message.pushInt(code,+attributes[key]); // TODO expand...
        }

        self.redis.mset([schema.ack.message.key,JSON.stringify(message),message.sequenceNumber,schema.ack.retries.key,0,schema.ack.sequenceNumber.key],self.redisLogError);
        self.transmitMessage(message.toWire());
    }));
};

M2mTransmitter.prototype.transmitMessage = function(message){
    logger.info('transmit: ' + JSON.stringify(message));
    this.idleCount = 0;
    this.client.send(message.toWire(),'localhost',+this.gateway[this.gateway.primary + 'Relay']); // TODO which relay to use?
};

M2mTransmitter.prototype.asyncCheckQueue = function(){
    setTimeout(this.checkQueueCallback,1);
};

M2mTransmitter.prototype.redisCheckResult = function(err,value,callback) {
    if (!err)
        callback(value);
    else {
        logger.error('redis error: ' + err);
        this.stats.increment('error');
        this.noteEvent('error');
        this.asyncCheckQueue();
    }
};

M2mTransmitter.prototype.redisLogError = function(err,value,callback) {
    if (err) {
        logger.error('redis error: ' + err);
        this.stats.increment('error');
        this.noteEvent('error');
    }
};

M2mTransmitter.prototype.safeParseJSON = function(contents) {
    try {
        return JSON.parse(contents);
    } catch(e) {
        logger.error('json error: ' + e);
        this.stats.increment('error');
        this.noteEvent('error');
        return null;
    }
};

module.exports = M2mTransmitter;

