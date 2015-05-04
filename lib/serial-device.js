var util = require('util');
var events = require('events');

function SerialDevice(config) {
    var self = this;
    config = config || {};
    self.host = config.telnetAddress;
    self.port = +config.telnetPort;
    self.retryInterval = config.retryInterval || 15*1000;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.errorEventCallback = function(error){ self.emit('error',error.toString()); };
    self.serialport = require('serialport'); // NOTE - delayed for mocking

}

util.inherits(SerialDevice,events.EventEmitter);

SerialDevice.prototype.opened = function(){
    return !!this.openCalled;
};

SerialDevice.prototype.ready = function(){
    return !!this.client;
};

SerialDevice.prototype.open = function() {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.attemptOpen();
    return this;
};

SerialDevice.prototype.close = function() {
    if (!this.opened()) throw(new Error('not open'));

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    
    if (this.client) this.client.end();
    this.client = null;

    this.openCalled = false;
};

SerialDevice.prototype.attemptOpen = function(){
    var self = this;
    try {
        self.timeout = null;
        self.client = self.net.connect({port: self.port,host: self.host},function(){
            self.emit('ready');
        });
        self.client.on('data',self.dataEventCallback);
        self.client.on('error',self.errorEventCallback);
    } catch(e) {
        self.timeout = setTimeout(self.attemptOpenCallback,self.retryInterval);
        self.emit('retry', e.toString());
    }
};

SerialDevice.prototype.writeBuffer = function(buffer,callback){
    try {
        if (this.ready())
            this.client.write(buffer,function(){ callback && callback(null); });
        else
            callback && callback('not ready');
    } catch (e) {
        callback && callback(e.toString());
    }
};

module.exports = SerialDevice;

