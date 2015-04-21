var _ = require('lodash');
var m2m = require('m2m-ota-javascript');
var util = require('util');
var events = require('events');

var logger = require('../lib/logger')('heartbeat');
var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

function HeartbeatGenerator(redis,proxy,config) {
    var self = this;
    self.redis = redis;
    self.proxy = proxy;
    self.config = _.defaults(config || {},{
        heartbeatInterval:  60*60*1000
    });
}

util.inherits(HeartbeatGenerator,events.EventEmitter);

HeartbeatGenerator.prototype.started = function(){
    return !!this.interval;
};

HeartbeatGenerator.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start heartbeat');

    var self = this;
    self.sendHeartbeat(settings.EventCodes.startup);
    self.interval = setInterval(function(){ self.considerHeartbeat(); },self.config.heartbeatInterval);
    return self;
};

HeartbeatGenerator.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop heartbeat');

    clearInterval(this.interval);
};

HeartbeatGenerator.prototype.considerHeartbeat = function(){
    var self = this;
    self.redis.get(schema.transmit.lastPrivateTimestamp.key).then(function(lastPrivateTimestamp){
        if (new Date().valueOf() < +lastPrivateTimestamp + self.config.heartbeatInterval)
            self.emit('note','skip');
        else {
            self.redis.llen(schema.transmit.queue.key).then(function(length){
                if (+length > 0)
                    self.emit('note','skip');
                else
                    self.sendHeartbeat(settings.EventCodes.heartbeat);
            });
        }
    });
};

HeartbeatGenerator.prototype.sendHeartbeat = function(eventCode){
    var self = this;
    self.redis.incr(schema.transmit.lastSequenceNumber.key).then(function(sequenceNumber){
        logger.info('send heartbeat: ' + eventCode);
        var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: sequenceNumber})
            .pushString(0,self.proxy.gateway.imei);
        self.proxy.sendPrimary(message.toWire(),message.sequenceNumber);
        self.emit('note','heartbeat');
    });
};

module.exports = HeartbeatGenerator;

