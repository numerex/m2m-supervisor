var util = require('util');

var IoDevice = require('./io-device');

function TelnetDevice(config) {
    config = config || {};
    var self = this;
    IoDevice.apply(self,[config]);
    self.host = config.telnetAddress;
    self.port = +config.telnetPort;
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.errorEventCallback = function(error){ self.emit('error',error.toString()); };
    self.net = require('net'); // NOTE - delayed for mocking

}

util.inherits(TelnetDevice,IoDevice);

TelnetDevice.prototype._onClose = function() {
    if (this.client) this.client.end();
    this.client = null;
};

TelnetDevice.prototype._onOpen = function(callback){
    this.client = this.net.connect({port: this.port,host: this.host},callback)
        .on('data',this.dataEventCallback)
        .on('error',this.errorEventCallback);
};

TelnetDevice.prototype._onWrite = function(buffer,callback){
    this.client.write(buffer,function(){ callback && callback(null); });
};

module.exports = TelnetDevice;

