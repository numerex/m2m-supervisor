var FileDevice = require('./file-device');
var SerialDevice = require('./serial-device');
var TelnetDevice = require('./telnet-device');

function DeviceBuilder(config){
}

DeviceBuilder.prototype.newDevice = function(config){
    config = config || {};
    switch(config.type){
        case 'file':
            return new FileDevice(config);
        case 'serial':
            return new SerialDevice(config);
        case 'telnet':
            return new TelnetDevice(config);
    }
    return null;
};


module.exports = new DeviceBuilder();