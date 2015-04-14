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

RedisCheckpoint.prototype.start = function(callback) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start checkpoint');

    var self = this;
    self.redis = require('redis'); // NOTE - delay require for mockery testing

    // istanbul ignore next -- TODO review for correctness... is this the right way to trap these errors???
    self.redis.RedisClient.prototype.on_error = function(err){
        logger.error('redis not ready: ' + err);
        if (self.client) self.client.end();
        self.client = null;
        if (self.started()) {
            self.attemptCheckCallback = function(){ self.attemptCheck(null); };
            self.timeout = setTimeout(self.attemptCheckCallback,self.config.retryInterval);
        }
    };

    self.startCalled = true;
    self.attemptCheckCallback = function(){ self.attemptCheck(callback); };
    self.timeout = setTimeout(self.attemptCheckCallback,1);
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
    this.timeout = null;
    try {
        this.client = this.redis.createClient();
    } catch(e) {
        this.timeout = setTimeout(this.attemptCheckCallback,this.config.retryInterval);
        logger.info('not ready: ' + e);
        callback && callback('retry');
        return;
    }

    callback && callback('ready',this.client);
};

module.exports = RedisCheckpoint;
