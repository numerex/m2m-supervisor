var util = require('util');

var IoPeripheral = require('./io-peripheral');

function SerialPeripheral(config) {
    config = config || {};
    var self = this;
    IoPeripheral.apply(self,[config]);
    self.port = config.serialPort;
    self.baudrate = +config.serialBaudRate;
    self.closeEventCallback = function(){ self.emit('close'); };
    self.dataEventCallback = function(data){ self.emit('data',data.toString()); };
    self.errorEventCallback = function(error){ self.emit('error',error.toString()); };
    self.serialport = require('serialport'); // NOTE - delayed for mocking
}

util.inherits(SerialPeripheral,IoPeripheral);

SerialPeripheral.prototype._onClose = function() {
    if (this.connection) this.connection.close();
    this.connection = null;
};

SerialPeripheral.prototype._onOpen = function(callback){
    var self = this;
    self.connection = new self.serialport.SerialPort(self.port,{baudrate: self.baudrate},false);
    self.connection
        .on('error',self.errorEventCallback)
        .open(function(error){
            if (error) {
                self.connection = null;
                callback(error);
            } else {
                self.connection
                    .on('close',self.closeEventCallback)
                    .on('data',self.dataEventCallback);
                callback(null);
            }
        });
};

SerialPeripheral.prototype._onWrite = function(buffer,callback){
    this.connection.write(buffer,function(){ callback && callback(null); });
};

module.exports = SerialPeripheral;
