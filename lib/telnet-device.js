var util = require('util');

var IoDevice = require('./io-device');

function TelnetDevice(config) {
    config = config || {};
    var self = this;
    IoDevice.apply(self,[config]);
    self.host = config.telnetAddress;
    self.port = +config.telnetPort;
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.net = require('net'); // NOTE - delayed for mocking

}

util.inherits(TelnetDevice,IoDevice);

TelnetDevice.prototype._onClose = function() {
    // istanbul ignore else - should not occur, but makes me nervous not to check...
    if (this.client) this.client.end();
    this.client = null;
};

TelnetDevice.prototype._onOpen = function(callback){
    var self = this;
    self.client = self.net.connect({port: self.port,host: self.host},function(){
        var previous = callback;
        callback = null;
        previous && previous(null);
    });
    self.client
        .on('data',self.dataEventCallback)
        .on('error',function(error){
            var previous = callback;
            callback = null;
            if (previous)
                previous(error);
            else
                self.emit('error',error);
        });
};

TelnetDevice.prototype._onWrite = function(buffer,callback){
    this.client.write(buffer,function(){ callback && callback(null); });
};

module.exports = TelnetDevice;

