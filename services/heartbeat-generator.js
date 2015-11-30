var _ = require('lodash');
var m2m = require('m2m-ota-javascript');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('../lib/logger')('heartbeat');
var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

var MILLIS_PER_MIN = 60 * 1000;

function HeartbeatGenerator(gateway,config) {
    Watcher.apply(this,[logger,config,true]);
    this.gateway = gateway;
}

util.inherits(HeartbeatGenerator,Watcher);

HeartbeatGenerator.MILLIS_PER_MIN = MILLIS_PER_MIN;

HeartbeatGenerator.prototype._onStart = function(config,client) {
  console.log("heartbeat generator onStart was called");
  console.log(client.constructor.name);
    var self = this;
    self.client = client;
    self.heartbeatInterval = config.heartbeatInterval;
    self.sendHeartbeat(settings.EventCodes.startup);
    self.interval = setInterval(function(){ self.considerHeartbeat(); },self.heartbeatInterval * MILLIS_PER_MIN);
};

HeartbeatGenerator.prototype._onStop = function() {
    clearInterval(this.interval);
};

HeartbeatGenerator.prototype.considerHeartbeat = function(){
    var self = this;
    self.client.get(schema.transmit.lastPrivateTimestamp.key).thenHint('getTimestamp',function(lastPrivateTimestamp){
        if (new Date().valueOf() < +lastPrivateTimestamp + self.heartbeatInterval * MILLIS_PER_MIN + 10)
            self.emit('note','skip');
        else {
            self.client.llen(schema.transmit.queue.key).thenHint('getQueueLength',function(length){
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
    self.client.incr(schema.transmit.lastSequenceNumber.key).thenHint('incrSequenceNumber',function(sequenceNumber){
        sequenceNumber = (+sequenceNumber - 1) % 1000 + 1; // TODO needs to be DRY...
        logger.info('send heartbeat: ' + eventCode);
        var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: sequenceNumber})
            .pushString(0,self.gateway.config.imei);
        self.gateway.sendPrivate(message.toWire(),message.sequenceNumber);
        self.emit('note','heartbeat');
    });
};

module.exports = HeartbeatGenerator;

