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

    self.emit('change',null);
};

HashWatcher.prototype._onCheckReady = function(callback){
    var self = this;
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
        callback(self.readyStatus);
    });
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

HashWatcher.prototype.validateRequirements = function(needs,requirements){
    return _.difference(requirements,_.intersection(requirements,_.keys(this.hash))).length > 0 ?
        null :
        helpers.hash2config(this.hash,needs);
};

HashWatcher.prototype.checkKeysetWatcher = function(target){
    var self = this;
    var result = self.validateRequirements(target.needs,target.requirements);
    if (result)
        target.ready = true;
    else
        self.readyStatus = target.ready = false;
    if (target.watcher.started())
        target.watcher.stop();
    if (target.ready)
        target.watcher.start(helpers.hash2config(self.hash,target.needs));
};

module.exports = HashWatcher;

