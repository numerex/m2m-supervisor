var _ = require('lodash');
var net = require('net');
var util = require('util');
var events = require('events');

function TelnetDevice(config) {
    var self = this;
    config = _.defaults(config || {},{
        retryInterval:   15*1000
    });
    self.host = config.telnetAddress;
    self.port = +config.telnetPort;
    self.retryInterval = config.retryInterval;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.errorEventCallback = function(error){ self.emit('error',error.toString()); };
}

util.inherits(TelnetDevice,events.EventEmitter);

TelnetDevice.prototype.opened = function(){
    return !!this.openCalled;
};

TelnetDevice.prototype.ready = function(){
    return !!this.client;
};

TelnetDevice.prototype.open = function() {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.attemptOpen();
    return this;
};

TelnetDevice.prototype.close = function() {
    if (!this.opened()) throw(new Error('not open'));

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    
    if (this.client) this.client.end();
    this.client = null;

    this.openCalled = false;
};

TelnetDevice.prototype.attemptOpen = function(){
    var self = this;
    try {
        self.timeout = null;
        self.client = net.connect({port: self.port,host: self.host},function(){
            self.emit('ready');
        });
        self.client.on('data',self.dataEventCallback);
        self.client.on('error',self.errorEventCallback);
    } catch(e) {
        self.timeout = setTimeout(self.attemptOpenCallback,self.retryInterval);
        self.emit('retry', e.toString());
    }
};

TelnetDevice.prototype.writeBuffer = function(buffer,callback){
    try {
        if (this.ready())
            this.client.write(buffer,function(){ callback && callback(null); });
        else
            callback && callback('not ready');
    } catch (e) {
        callback && callback(e.toString());
    }
};

module.exports = TelnetDevice;

