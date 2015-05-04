var _ = require('lodash');
var util = require('util');
var events = require('events');

var globalCounter = 0;

function IoDevice(config) {
    config = config || {};

    var self = this;
    self.retryInterval = config.retryInterval || 15*1000;
    self.instance = ++globalCounter;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.on('attemptOpen',self.attemptOpenCallback);
}

util.inherits(IoDevice,events.EventEmitter);

IoDevice.prototype.opened = function(){
    return !!this.openCalled;
};

IoDevice.prototype.ready = function(){
    return !!this.readyState;
};

IoDevice.prototype.open = function() {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.emit('attemptOpen');
    return this;
};

IoDevice.prototype.close = function() {
    if (!this.opened()) throw(new Error('not open'));

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    this._onClose();

    this.openCalled = false;
    this.readyState = false;
};

IoDevice.prototype.attemptOpen = function(){
    var self = this;
    try {
        self.timeout = null;
        self._onOpen(function(){
            self.readyState = true;
            self.emit('ready');
        });
    } catch(e) {
        self.timeout = setTimeout(function(){ self.emit('attemptOpen'); },self.retryInterval);
        self.emit('retry', e.toString());
    }
};

IoDevice.prototype.writeBuffer = function(buffer,callback){
    if (!this.ready()) return callback && callback('not ready');

    try {
        this._onWrite(buffer,callback);
    } catch (e) {
        callback && callback(e.toString());
    }
};

module.exports = IoDevice;

