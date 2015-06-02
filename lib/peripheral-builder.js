var FilePeripheral = require('./file-peripheral');
var SerialPeripheral = require('./serial-peripheral');
var TelnetPeripheral = require('./telnet-peripheral');

function PeripheralBuilder(config){
}

PeripheralBuilder.prototype.newPeripheral = function(config){
    config = config || {};
    switch(config.type){
        case 'file':
            return new FilePeripheral(config);
        case 'serial':
            return new SerialPeripheral(config);
        case 'telnet':
            return new TelnetPeripheral(config);
    }
    return null;
};


module.exports = new PeripheralBuilder();