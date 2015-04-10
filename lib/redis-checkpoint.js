var _ = require('lodash');
var logger = require('./logger')('redis-chk');

function RedisCheckpoint(config){
    var self = this;
    self.config = _.defaults(config || {},{
        retryInterval:      5*1000
    });
    self.redis = require('redis'); // NOTE - delay require for mockery testing

    self.redis.RedisClient.prototype.on_error = function(err){ // TODO review for correctness... this is HACK!
        logger.error('redis not ready: ' + err);
        if (self.client) self.client.end();
        self.client = null;
        if (self.started()) {
            self.attemptCheckCallback = function(){ self.attemptCheck(null); };
            setTimeout(self.attemptCheckCallback,self.config.retryInterval);
        }
    }
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
        this.client = this.redis.createClient();
    } catch(e) {
        setTimeout(this.attemptCheckCallback,this.config.retryInterval);
        logger.info('not ready: ' + e);
        callback && callback('retry');
        return;
    }

    callback && callback('ready',this.client);
};

module.exports = RedisCheckpoint;
