var _ = require('lodash');
var util = require('util');
var events = require('events');

function Watcher(logger,config,noReadyRetry) {
    config = config || {};
    var self = this;
    self.logger = logger;
    self.qualifier = config.qualifier ? ': ' + config.qualifier : '';
    self.retryInterval = config.retryInterval || 5*1000;
    self.noReadyRetry = noReadyRetry;
    if (!self.noReadyRetry) {
        self.checkReadyCallback = function(){ self.checkReady(); };
        self.on('checkReady',self.checkReadyCallback);
    }
}

util.inherits(Watcher,events.EventEmitter);

Watcher.prototype.started = function(){
    return !!this.startCalled;
};

Watcher.prototype.ready = function(){
    return this.started() && !!this.readyState;
};

Watcher.prototype.start = function(arg1,arg2) {
    var self = this;
    if (self.started()) throw(new Error('already started'));

    self.logger.info('start watching' + self.qualifier);

    self.startCalled = true;
    self._onStart(arg1,arg2);
    if (!self.noReadyRetry) self.emit('checkReady');
    return self;
};

Watcher.prototype.stop = function(){
    var self = this;
    if (!self.started()) throw(new Error('not started'));

    self.logger.info('stop watching' + self.qualifier);

    self.startCalled = false;

    if (self.retryTimeout) clearTimeout(self.retryTimeout);
    self.retryTimeout = null;

    self._onStop();
    if (self.readyState) self.emit('ready',self.readyState = null);
};

Watcher.prototype.ensureStartStop = function(arg1,arg2){
    if (arg1 && !this.started()) this.start(arg1,arg2);
    if (!arg1 && this.started()) this.stop();
};

Watcher.prototype.checkReady = function(){
    var self = this;
    self.retryTimeout = null;
    if (!self.started() || !self.checkReadyCallback) return;

    self.logger.info('check ready' + self.qualifier);
    self._onCheckReady(function(ready){ if (self.started()) self.noteReady(ready); });
};

Watcher.prototype.noteReady = function(ready){
    if (!this.started()) return;

    var wasReady = this.readyState;
    if (this.readyState = ready){
        if (!wasReady) {
            this.logger.info('now ready' + this.qualifier);
            this.emit('ready',this.readyState);
        }
    } else {
        if (wasReady) {
            this.logger.info('no longer ready' + this.qualifier);
            this.emit('ready',null);
        }
        if (!this.noReadyRetry) this.retryTimeout = setTimeout(this.checkReadyCallback,this.retryInterval);
        this.emit('retry');
    }
};

Watcher.prototype._onStart = function(arg1,arg2){
};

Watcher.prototype._onCheckReady = function(callback){
    callback(true);
};

Watcher.prototype._onStop = function(){
};

module.exports = Watcher;

