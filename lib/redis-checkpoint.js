var _ = require('lodash');
var logger = require('./logger')('redis-chk');

function RedisCheckpoint(config){
    this.redis = require('redis'); // NOTE - delay require for mockery testing
    this.config = _.defaults(config || {},{
        retryInterval:      5*1000
    });
}

RedisCheckpoint.prototype.started = function(){
    return !!this.startCalled;
};

RedisCheckpoint.prototype.start = function(callback) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start checkpoint');

    var self = this;
    self.startCalled = true;
    self.attemptCheckCallback = function(){ self.attemptCheck(callback); };
    setTimeout(self.attemptCheckCallback,1);
    return self;
};

RedisCheckpoint.prototype.stop = function(){
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop checkpoint');

    if (this.client) this.client.quit();
    this.client = null;
    this.startCalled = false;
};

RedisCheckpoint.prototype.attemptCheck = function(callback){
    if (!this.started()) return;

    try {
        callback('ready',this.client = this.redis.createClient());

    } catch(e) {
        setTimeout(this.attemptCheckCallback,this.config.retryInterval);
        logger.info('not ready');
        callback('retry');
    }
};

module.exports = RedisCheckpoint;
