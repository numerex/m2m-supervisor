var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('./../lib/logger')('redis');

function RedisWatcher(config){
    Watcher.apply(this,[logger,config]);

    if (RedisWatcher.instance) {
        RedisWatcher.instance.removeAllListeners();
        logger.info('instance removed');
    }

    RedisWatcher.instance = this;
    logger.info('instance created');
}

util.inherits(RedisWatcher,Watcher);

RedisWatcher.prototype._onStop = function(){
    if (this.client) this.client.quit();
    this.client = null;
};

RedisWatcher.prototype._onCheckReady = function(callback){
    var self = this;
    self.client = require('../lib/hinted-redis').createClient().on('error',function(error){
        logger.error('redis client error: ' + error);

        // istanbul ignore else - this shouldn't occur, but just nervous about assuming it won't
        if (self.client) self.client._redisClient.end();
        self.client = null;

        if (!callback)
            self.emit('checkReady');
        else {
            callback(null);
            callback = null;
        }
    });
    self.client.keys('*')
        .then(function(keys){
            self.keys = keys;
            callback(self.client);
        })
        .error(function(){})
        .done();
};

RedisWatcher.prototype.addClientWatcher = function(watcher){
    this.on('ready',function(client){
        if (client && !watcher.started())
            watcher.start(client);
        // istanbul ignore else - condition should never occur
        else if (!client && watcher.started())
            watcher.stop();
    });
    if (this.client && !watcher.started()) watcher.start(this.client);
    return this;
};

module.exports = RedisWatcher;
