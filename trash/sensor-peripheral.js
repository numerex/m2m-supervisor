
var log = require('./bunyan-logger');
var util = require('util');
var GpioPeripheral = require('./gpio-peripheral');

util.inherits(SensorPeripheral,GpioPeripheral);

function genericType(type) {
  if (type == "05V" || type == "420mA") {
    return "analog";
  } else {
    return "digital";
  }
}

function SensorPeripheral(config) {
  config = config || {};
  var self = this;
  GpioPeripheral.apply(self, [config]);

  self.log("Initializing sensor " + self.name);

  var sensorConfig = config[self.name];

  self.specificType = sensorConfig.type;
  self.genericType = genericType(self.specificType);

  self.log("Type is " + self.specificType + " (" + self.genericType + ")");

  if (sensorConfig.coefficients) {
    self.coefficients = JSON.parse(sensorConfig.coefficients);
    self.log("Coefficients = " + self.coefficients);
  } 

  self.units   = sensorConfig.units;

  self.input   = 0; // Raw input
  self.scaled  = 0; // Scaled value (mA or V)
  self.reading = 0; // Translated reading

};

SensorPeripheral.prototype.log = function(logmsg) {
  var self = this;
  log.info("[" + self.name + "] " + logmsg);
}

SensorPeripheral.prototype.takeReading = function() {
  var self = this;
  self.input = self.value(); // Obtain raw voltage from GpioPeripheral
  self.scale();            // Scale the reading
  self.translate();        // Translate the reading
}

SensorPeripheral.prototype.scale = function() {
  var self = this;

  if (self.specificType == "420mA") {
    self.scaled = (self.input/4095) * 20;
  } else if (self.specificType == "05V") {
    self.scaled = (self.input/4095) * 5;
  } else {
    // Throw an error or something
  }

}

SensorPeripheral.prototype.translate = function() {
  var self = this;
  // Coefficients are provided as an array
  // For example, [1.875, -7.5], is f(x) = 1.875x - 7.5

  var order = self.coefficients.length - 1;
 
  self.reading = 0.0; 
  for (var i = 0; i < self.coefficients.length; i++) {
    self.reading += self.coefficients[order] * Math.pow(self.scaled, i);
    order--;
  }

};


module.exports = SensorPeripheral;