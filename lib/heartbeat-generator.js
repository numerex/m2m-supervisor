var _ = require('lodash');
var logger = require('./logger')('heartbeat');
var schema = require('./redis-schema');
var settings = require('./m2m-settings');

function HeartbeatGenerator(config) {
    var self = this;
    self.config = _.defaults(config || {},{
        heartbeatInterval:  60*60*1000
    });
    self.stats = require('./statsd-client')('heartbeat');   // NOTE - delay require for mockery testing
    self.redis = require('redis').createClient();           // NOTE - delay require for mockery testing
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
    self.redis.lpush(schema.transmit.queue.key,JSON.stringify({eventCode: eventCode}),_.bind(self.redisResult,self,_,_,function(value){
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

