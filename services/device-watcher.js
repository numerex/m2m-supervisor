var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('../lib/logger')('device');
var builder = require('../lib/device-builder');

function DeviceWatcher(deviceKey){
    Watcher.apply(this,[logger,{qualifier: deviceKey}]);
}

util.inherits(DeviceWatcher,Watcher);

DeviceWatcher.prototype._onStart = function(config){
    this.config = config;
    this.device = builder.newDevice(config);
};

module.exports = DeviceWatcher;