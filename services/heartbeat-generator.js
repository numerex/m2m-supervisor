var _ = require('lodash');
var m2m = require('m2m-ota-javascript');

var logger = require('./../lib/logger')('heartbeat');
var schema = require('./../lib/redis-schema');
var settings = require('./../lib/m2m-settings');

function HeartbeatGenerator(proxy,config) {
    var self = this;
    self.proxy = proxy;
    self.config = _.defaults(config || {},{
        heartbeatInterval:  60*60*1000
    });
    self.stats = require('./../lib/statsd-client')('heartbeat');    // NOTE - delay require for mockery testing
    self.redis = require('redis').createClient();                   // NOTE - delay require for mockery testing
}

HeartbeatGenerator.prototype.started = function(){
    return !!this.interval;
};

HeartbeatGenerator.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start heartbeat');
    this.stats.increment('started');

    var self = this;
    self.noteEvent = note || function(){};
    self.sendHeartbeat(settings.EventCodes.startup);
    self.interval = setInterval(function(){ self.considerHeartbeat(); },self.config.heartbeatInterval);
    return self;
};

HeartbeatGenerator.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop heartbeat');
    this.stats.increment('stopped');

    clearInterval(this.interval);
};

HeartbeatGenerator.prototype.considerHeartbeat = function(){
    var self = this;
    self.redis.get(schema.transmit.lastPrivateTimestamp.key,_.bind(self.redisResult,self,_,_,function(value){
        if (new Date().valueOf() < +value + self.config.heartbeatInterval)
            self.skipHeatbeat();
        else {
            self.redis.llen(schema.transmit.queue.key, _.bind(self.redisResult,self,_,_,function(value){
                if (+value > 0)
                    self.skipHeatbeat();
                else
                    self.sendHeartbeat(settings.EventCodes.heartbeat);
            }));
        }
    }));
};

HeartbeatGenerator.prototype.skipHeatbeat = function(){
    this.stats.increment('skipped');
    this.noteEvent('skip');
};

HeartbeatGenerator.prototype.sendHeartbeat = function(eventCode){
    var self = this;
    self.redis.incr(schema.transmit.lastSequenceNumber.key,_.bind(self.redisResult,self,_,_,function(sequenceNumber){
        logger.info('send heartbeat: ' + eventCode);
        var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: sequenceNumber})
            .pushString(0,self.proxy.gateway.imei);
        self.proxy.sendPrimary(message.toWire());
        self.stats.increment('sent');
        self.noteEvent('heartbeat');
    }));
};

HeartbeatGenerator.prototype.redisResult = function(err,value,callback) {
    if (!err)
        callback(value);
    else {
        logger.error('redis error: ' + err);
        this.stats.increment('error');
        this.noteEvent('error');
    }
};

module.exports = HeartbeatGenerator;

