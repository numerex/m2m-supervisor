/*
 * SensorManager is responsible for managing sensors.  
 *
 * When sensors have data to report they call back onto the manager, which
 * packages up the data and sends it to the gateway.
 *
 */

var _    = require('lodash');
var m2m  = require('m2m-ota-javascript');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('../lib/logger')('sensor-manager');
var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

var MILLIS_PER_MIN = 60 * 1000;

function SensorManager(gateway,config) {
//  Watcher.apply(this,[logger,config,true]);
  this.gateway = gateway;
}

//util.inherits(SensorManager,Watcher);

SensorManager.MILLIS_PER_MIN = MILLIS_PER_MIN;

/*
SensorManager.prototype._onStart = function(config,client) {
  var self = this;
  self.client = client;
  self.heartbeatInterval = config.heartbeatInterval;
  self.sendHeartbeat(settings.EventCodes.startup);
  self.interval = setInterval(function(){ self.considerHeartbeat(); },self.heartbeatInterval * MILLIS_PER_MIN);
};

SensorManager.prototype._onStop = function() {
  clearInterval(this.interval);
};
*/

SensorManager.prototype.sendReport = function(eventCode) {
  var self = this;

  self.client.incr(schema.transmit.lastSequenceNumber.key).thenHint('incrSequenceNumber',function(sequenceNumber)
								    {
								      sequenceNumber = (+sequenceNumber - 1) % 1000 + 1;
    logger.info('send heartbeat: ' + eventCode);
    var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: sequenceNumber})
      .pushString(0,self.gateway.config.imei);
    self.gateway.sendPrivate(message.toWire(),message.sequenceNumber);
    self.emit('note','heartbeat');
  });
};

module.exports = SensorManager;

