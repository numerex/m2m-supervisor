var util = require('util');
var GpioPeripheral = require('./gpio-peripheral');

util.inherits(ActuatorPeripheral,GpioPeripheral);

function ActuatorPeripheral(config) {
  config = config || {};
  var self = this;
  GpioPeripheral.apply(self, [config]);

  self.name = config.name; // digital_output_01
  
};

ActuatorPeripheral.prototype.getName = function() {
  return this.name;
}

module.exports = ActuatorPeripheral;