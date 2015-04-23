var _ = require('lodash');
var logger = require('./../lib/logger')('redis-chk');

function RedisCheckpoint(config){
    var self = this;
    self.config = _.defaults(config || {},{
        retryInterval:      5*1000
    });
}

RedisCheckpoint.prototype.started = function(){
    return !!this.startCalled;
};

RedisCheckpoint.prototype.ready = function(){
    return !!this.client;
};

RedisCheckpoint.prototype.start = function(callback) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start checkpoint');

    var self = this;
    self.redis = require('then-redis'); // NOTE - delay require for mockery testing

    self.startCalled = true;
    self.attemptCheckCallback = function(){ self.attemptCheck(callback); };
    self.attemptCheckCallback();
    return self;
};

RedisCheckpoint.prototype.stop = function(){
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop checkpoint');

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    if (this.client) this.client.quit();
    this.client = null;
    this.redis = null;
    this.startCalled = false;
};

RedisCheckpoint.prototype.attemptCheck = function(callback){
    var self = this;
    self.timeout = null;
    self.client = self.redis.createClient().on('error',function(error){
        logger.error('redis client error: ' + error);
        // istanbul ignore else - this shouldn't occur, but just nervous about assuming it won't
        if (self.client) self.client._redisClient.end();
        self.client = null;
        self.timeout = setTimeout(self.attemptCheckCallback,self.config.retryInterval);
        callback && callback('retry');
    });
    self.client.keys('*')
        .then(function(keys){
            self.keys = keys;
            callback && callback('ready',self.client);
        })
        .error(function(error){})
        .done();
};

module.exports = RedisCheckpoint;
