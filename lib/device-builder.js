var TelnetDevice = require('./telnet-device');
var FileDevice = require('./file-device');

function DeviceBuilder(config){
}

DeviceBuilder.prototype.newDevice = function(config){
    switch(config.type){
        case 'telnet':
            return new TelnetDevice(config);
        case 'file':
            return new FileDevice(config);
    }
    return null;
};


module.exports = new DeviceBuilder();