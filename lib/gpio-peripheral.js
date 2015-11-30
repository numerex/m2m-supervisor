/*
 * GpioPeripheral
 *
 * Idea behind a GpioPeripheral is that Digital, Analog Sensors and 
 * Actuators inherit from it for access to the underlying filesystem
 * which provides the raw values 
 *
 */

var fs  = require('fs');
var logger = require('./logger')('gpio');

var iioDir  = '/sys/bus/iio/devices/iio:device0/';
var gpioDir = '/sys/class/gpio/';

var files = {analog_input_01:  iioDir + "in_voltage0_raw",
             analog_input_02:  iioDir + "in_voltage1_raw",
	     analog_input_03:  iioDir + "in_voltage2_raw",
	     analog_input_04:  iioDir + "in_voltage3_raw",
	     digital_input_01:  gpioDir + "gpio65/value",
	     digital_input_02:  gpioDir + "gpio66/value",
             digital_input_03:  gpioDir + "gpio68/value",
	     digital_input_04:  gpioDir + "gpio69/value",
	     digital_output_01: gpioDir + "gpio26/value",
	     digital_output_02: gpioDir + "gpio27/value"};

function GpioPeripheral(config) {
  config = config || {};

  var self = this;

  // analog_input_01, digital_output_02, etc.
  self.name = Object.keys(config)[0];
  self.file = files[self.name];

};

GpioPeripheral.prototype.value = function() {
  var self = this;
  var value = NaN;
  try {
    value = parseInt(fs.readFileSync(self.file).toString().trim());
  } catch (e) {
    logger.error("Caught exception:  " + e.code);
  }
  return value;
};

/*
 * For an Actuator
 */
GpioPeripheral.prototype.setValue = function(value) {
  var self = this;
  logger.info("Writing " + value + " to " + self.file);
  fs.writeFileSync(self.file, value)
};

module.exports = GpioPeripheral;