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
    this.connection = new this.serialport.SerialPort(this.port,{baudrate: this.baudrate,xon: true,xoff: true},false)
        .on('close',this.closeEventCallback)
        .on('data',this.dataEventCallback)
        .on('error',this.errorEventCallback)
        .open(callback);
};

SerialDevice.prototype._onWrite = function(buffer,callback){
    this.connection.write(buffer,function(){ callback && callback(null); });
};

module.exports = SerialDevice;