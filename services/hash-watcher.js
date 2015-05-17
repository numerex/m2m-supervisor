var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

var helpers = require('../lib/hash-helpers');
var logger = require('../lib/logger')('hash');

function HashWatcher(rootKey,hashkeys,config) {
    Watcher.apply(this,[logger, _.defaults({qualifier: rootKey},config)]);
    this.rootKey = rootKey;
    this.hashkeys = hashkeys || {};
    this.keysetWatchers = [];
}

util.inherits(HashWatcher,Watcher);

HashWatcher.prototype._onStart = function(client) {
    this.client = client;
};

HashWatcher.prototype._onStop = function(){
    var self = this;

    self.client = null;
    self.hash = null;
    self.lastJSON = null;

    _.each(self.keysetWatchers,function(target){
        if (target.watcher.started()) target.watcher.stop();
    });

    self.emit('change',null,null);
};

HashWatcher.prototype._onCheckReady = function(callback){
    var self = this;
    self.client.hgetall(self.rootKey).thenHint('onCheckReady',function(hash){
        self.hash = hash || {};
        var json = JSON.stringify(self.hash);
        if (self.lastJSON !== json) {
            if (self.lastJSON) logger.info('hash changed: ' + self.rootKey);
            self.lastJSON = json;
            self.readyStatus = true;
            _.each(self.keysetWatchers, _.bind(self.checkKeysetWatcher,self));
            self.emit('change',self.hash,self.client);
        }
        callback(self.readyStatus);
    });
};

HashWatcher.prototype.addChangeWatcher = function(watcher){
    var self = this;
    self.on('change',function(hash){
        if (watcher.started())
            watcher.stop();
        if (hash)
            watcher.start(hash,self.client);
    });
    return self;
};


HashWatcher.prototype.addKeysetWatcher = function(keyset,required,watcher){
    var self = this;
    var target = {
        keyset: keyset,
        ready: false,
        watcher: watcher,
        needs: self.hashkeys[keyset],
        requirements: required ? helpers.requirements(self.hashkeys[keyset]) : []
    };
    self.keysetWatchers.push(target);
    if (self.started() && !self.checkKeysetWatcher(target))
        self.emit('checkReady');
    return self;
};

HashWatcher.prototype.validateRequirements = function(keyset,needs,requirements){
    var misses = _.difference(requirements,_.intersection(requirements,_.keys(this.hash)));
    if (misses.length == 0) return helpers.hash2config(this.hash,needs);

    logger.info('missing(' + keyset + '): ' + misses);
    return null;
};

HashWatcher.prototype.checkKeysetWatcher = function(target){
    var self = this;
    var result = self.validateRequirements(target.keyset,target.needs,target.requirements);
    if (result)
        target.ready = true;
    else
        self.readyStatus = target.ready = false;
    var json = JSON.stringify(result);
    if (json !== target.lastJSON) {
        target.lastJSON = json;
        if (target.watcher.started())
            target.watcher.stop();
        if (target.ready)
            target.watcher.start(helpers.hash2config(self.hash,target.needs),self.client);
    }
    return target.ready;
};

module.exports = HashWatcher;

