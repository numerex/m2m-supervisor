var util = require('util');

var IoDevice = require('./io-device');

function SerialDevice(config) {
    config = config || {};
    var self = this;
    IoDevice.apply(self,[config]);
    self.port = config.serialPort;
    self.baudrate = +config.serialBaudRate;
    self.closeEventCallback = function(){ self.emit('close'); };
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.errorEventCallback = function(error){ self.emit('error',error.toString()); };
    self.serialport = require('serialport'); // NOTE - delayed for mocking
}

util.inherits(SerialDevice,IoDevice);

SerialDevice.prototype._onClose = function() {
    if (this.connection) this.connection.close();
    this.connection = null;
};

SerialDevice.prototype._onOpen = function(callback){
    var self = this;
    self.connection = new self.serialport.SerialPort(self.port,{baudrate: self.baudrate,xon: true,xoff: true},false);
    self.connection.open(function(error){
        if (error)
            callback(error);
        else {
            self.connection
                .on('close',self.closeEventCallback)
                .on('data',self.dataEventCallback)
                .on('error',self.errorEventCallback);
            callback(null);
        }
    });
};

SerialDevice.prototype._onWrite = function(buffer,callback){
    this.connection.write(buffer,function(){ callback && callback(null); });
};

module.exports = SerialDevice;