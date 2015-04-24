var _ = require('lodash');
var util = require('util');
var events = require('events');

var helpers = require('../lib/hash-helpers');
var logger = require('../lib/logger')('hash');

function HashWatcher(rootKey,hashkeys,config) {
    var self = this;
    self.rootKey = rootKey;
    self.hashkeys = hashkeys || {};
    self.keysetWatchers = [];
    self.retryInterval = (config || {}).retryInterval || 5*1000;
    self.checkHashCallback = function(){ self.checkHash(); };
}

util.inherits(HashWatcher,events.EventEmitter);

HashWatcher.prototype.started = function(){
    return !!this.client;
};

HashWatcher.prototype.ready = function(){
    return !!this.readyStatus;
};

HashWatcher.prototype.start = function(client) {
    var self = this;
    if (self.started()) throw(new Error('already started'));

    logger.info('start watching: ' + self.rootKey);

    self.client = client;
    self.checkHashCallback();
    return self;
};

HashWatcher.prototype.stop = function(){
    var self = this;
    if (!self.started()) throw(new Error('not started'));

    logger.info('stop watching: ' + self.rootKey);

    if (self.timeout) clearTimeout(self.timeout);
    self.timeout = null;

    self.client = null;
    self.hash = null;
    self.lastJSON = null;

    _.each(self.keysetWatchers,function(target){
        if (target.watcher.started()) target.watcher.stop();
    });

    self.emit('change',null);
};

HashWatcher.prototype.addChangeWatcher = function(watcher){
    this.on('change',function(hash){
        if (watcher.started())
            watcher.stop();
        if (hash)
            watcher.start(hash);
    });
};


HashWatcher.prototype.addKeysetWatcher = function(keyset,required,watcher){
    var self = this;
    self.keysetWatchers.push({
        ready: false,
        watcher: watcher,
        needs: self.hashkeys[keyset],
        requirements: required ? helpers.requirements(self.hashkeys[keyset]) : []
    });
};

HashWatcher.prototype.checkHash = function(){
    var self = this;
    self.timeout = null;
    if (!self.started()) return;

    logger.info('check hash: ' + self.rootKey);
    self.client.hgetall(self.rootKey).then(function(hash){
        self.hash = hash || {};
        var json = JSON.stringify(self.hash);
        if (self.lastJSON !== json) {
            self.lastJSON = json;
            logger.info('hash changed: ' + self.rootKey);
            self.readyStatus = true;
            _.each(self.keysetWatchers, _.bind(self.checkKeysetWatcher,self));
            self.emit('change',self.hash);
        }
        if (!self.ready()) {
            self.timeout = setTimeout(self.checkHashCallback,self.retryInterval);
            self.emit('retry');
        }
    });
};

HashWatcher.prototype.checkKeysetWatcher = function(target){
    var self = this;
    if (_.difference(target.requirements,_.intersection(target.requirements,_.keys(self.hash))).length > 0)
        self.readyStatus = target.ready = false;
    else
        target.ready = true;
    if (target.watcher.started())
        target.watcher.stop();
    if (target.ready)
        target.watcher.start(helpers.hash2config(self.hash,target.needs));
};

module.exports = HashWatcher;

