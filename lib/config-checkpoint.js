var _ = require('lodash');

var logger = require('./logger')('cfg-chk');

function ConfigCheckpoint(redis,key,defaults,required,config) {
    this.redis = redis;
    this.key = key;
    this.defaults = defaults || {};
    this.required = required || [];
    this.config = _.defaults(config || {},{
        retryInterval:      5*1000
    });
}

ConfigCheckpoint.prototype.started = function(){
    return !!this.startCalled;
};

ConfigCheckpoint.prototype.start = function(callback) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start checkpoint');

    var self = this;
    self.startCalled = true;
    self.attemptCheckCallback = function(){ self.attemptCheck(callback); };
    setTimeout(self.attemptCheckCallback,1);
    return self;
};

ConfigCheckpoint.prototype.stop = function(){
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop checkpoint');
    this.startCalled = false;
};

ConfigCheckpoint.prototype.attemptCheck = function(callback){
    if (!this.started()) return;

    var self = this;
    self.redis.hgetall(self.key,function(err,hash){
        if (!err && hash && _.difference(self.required,_.intersection(self.required,Object.keys(hash))).length == 0)
            callback('ready',_.defaults(hash,self.defaults));
        else {
            setTimeout(self.attemptCheckCallback,self.config.retryInterval);
            if (err)
                logger.error('redis error: ' + err);
            else
                logger.info('not ready');
            callback('retry');
        }
    });
};

module.exports = ConfigCheckpoint;

