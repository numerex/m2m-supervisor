var _ = require('lodash');
var util = require('util');

var Watcher = require('./watcher');

var builder = require('./peripheral-builder');
var logger = require('./logger')('peripheral');

function PeripheralWatcher(peripheralKey){
    Watcher.apply(this,[logger,{qualifier: peripheralKey}]);
}

util.inherits(PeripheralWatcher,Watcher);

PeripheralWatcher.prototype._onStart = function(config){
    this.config = config;
    this.peripheral = builder.newPeripheral(config);
};

PeripheralWatcher.prototype._onStop = function(){
    this.peripheral = null;
};

module.exports = PeripheralWatcher;