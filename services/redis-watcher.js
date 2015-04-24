var _ = require('lodash');
var util = require('util');
var events = require('events');

var logger = require('./../lib/logger')('redis');

function RedisWatcher(config){
    this.config = _.defaults(config || {},{
        retryInterval: 5*1000
    });
    if (RedisWatcher.instance) {
        RedisWatcher.instance.removeAllListeners();
        logger.info('instance removed');
    }
    RedisWatcher.instance = this;
    logger.info('instance created');
}

util.inherits(RedisWatcher,events.EventEmitter);

RedisWatcher.prototype.started = function(){
    return !!this.startCalled;
};

RedisWatcher.prototype.ready = function(){
    return !!this.client;
};

RedisWatcher.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start watching');

    var self = this;
    self.redis = require('then-redis'); // NOTE - delay require for mockery testing

    self.startCalled = true;
    self._readyCheckCallback = function(){ self._readyCheck(); };
    self._readyCheckCallback();
    return self;
};

RedisWatcher.prototype.stop = function(){
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watching');

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    if (this.client) this.client.quit();
    this.client = null;

    if (this.readyNoted) this.emit('ready',null);
    this.readyNoted = false;

    this.redis = null;
    this.startCalled = false;
};

RedisWatcher.prototype.addClientWatcher = function(watcher){
    this.on('ready',function(client){
        if (client && !watcher.started())
            watcher.start(client);
        // istanbul ignore else - condition should never occur
        else if (!client && watcher.started())
            watcher.stop();
    });
};

RedisWatcher.prototype._readyCheck = function(){
    var self = this;
    self.timeout = null;
    self.client = self.redis.createClient().on('error',function(error){
        logger.error('redis client error: ' + error);

        // istanbul ignore else - this shouldn't occur, but just nervous about assuming it won't
        if (self.client) self.client._redisClient.end();
        self.client = null;

        if (self.readyNoted) {
            logger.info('client no longer ready');
            self.emit('ready',null);
        }
        self.readyNoted = false;

        self.timeout = setTimeout(self._readyCheckCallback,self.config.retryInterval);
        self.emit('retry');
    });
    self.client.keys('*')
        .then(function(keys){
            self.keys = keys;
            self.readyNoted = true;
            logger.info('client ready');
            self.emit('ready',self.client);
        })
        .error(function(error){})
        .done();
};

module.exports = RedisWatcher;
