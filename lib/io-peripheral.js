var _ = require('lodash');
var util = require('util');
var events = require('events');

var globalCounter = 0;

function IoPeripheral(config) {
    config = config || {};

    var self = this;
    self.retryInterval = config.retryInterval || 15*1000;
    self.instance = ++globalCounter;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.on('attemptOpen',self.attemptOpenCallback);
}

util.inherits(IoPeripheral,events.EventEmitter);

IoPeripheral.prototype.opened = function(){
    return !!this.openCalled;
};

IoPeripheral.prototype.ready = function(){
    return !!this.readyState;
};

IoPeripheral.prototype.open = function() {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.emit('attemptOpen');
    return this;
};

IoPeripheral.prototype.close = function() {
    if (!this.opened()) throw(new Error('not open'));

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    this._onClose();

    this.openCalled = false;
    this.readyState = false;
};

IoPeripheral.prototype.attemptOpen = function(){
    var self = this;
    self.timeout = null;
    // istanbul ignore if - should not happen; not sure how to make it happen, but nervous about not checking...
    if (!self.opened()) return;

    try {
        self._onOpen(function(error){
            if (error)
                self.retry(error);
            else {
                self.readyState = true;
                self.emit('ready');
            }
        });
    } catch(e) {
        self.retry(e)
    }
};

IoPeripheral.prototype.retry = function(reason){
    this.timeout = setTimeout(_.bind(this.emit,this,'attemptOpen'),this.retryInterval);
    this.emit('retry',reason);
};

IoPeripheral.prototype.writeBuffer = function(buffer,callback){
    if (!this.ready()) return callback && callback(new Error('not ready'));

    try {
        this._onWrite(buffer,callback);
    } catch (e) {
        callback && callback(e);
    }
};

module.exports = IoPeripheral;

