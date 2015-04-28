var _ = require('lodash');
var util = require('util');

var Watcher = require('./watcher');

var builder = require('./device-builder');
var logger = require('./logger')('device');

function DeviceWatcher(deviceKey){
    Watcher.apply(this,[logger,{qualifier: deviceKey}]);
}

util.inherits(DeviceWatcher,Watcher);

DeviceWatcher.prototype._onStart = function(config){
    this.config = config;
    this.device = builder.newDevice(config);
};

DeviceWatcher.prototype._onStop = function(){
    this.device = null;
};

module.exports = DeviceWatcher;