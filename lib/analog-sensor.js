/*
 * AnalogSensor
 *
 * frequencies:  
 *                measure - How often to measure
 *                report  - How often to report
 *
 *
 */

var util = require('util');
var GpioPeripheral = require('./gpio-peripheral');

var logger = require('../lib/logger')('analog-sensor');

util.inherits(AnalogSensor, GpioPeripheral);

function AnalogSensor(callback, config) {
  config = config || {};
  var self = this;
  GpioPeripheral.apply(self, [config]);
  
  self.log("Initializing sensor " + self.name);
  
  var sensorConfig = config[self.name];
  
  self.specificType = sensorConfig.type;
  self.genericType =  "analog";
  
  self.log("Type is " + self.specificType + " (" + self.genericType + ")");

  if (sensorConfig.coefficients) {
    self.coefficients = JSON.parse(sensorConfig.coefficients);
    self.log("Coefficients = " + self.coefficients);
  } 

  self.units   = sensorConfig.units;

  // Thresholds
  self.thresholds = sensorConfig.thresholds;

  // Frequencies, how often to measure, how often to report
  // These are given in seconds
  self.measureFrequency = sensorConfig.frequencies.measure;
  self.reportFrequency  = sensorConfig.frequencies.report;

  // I don't know why I have to do this bind crap
  setInterval(self.takeReading.bind(self), self.measureFrequency * 1000);

  self.adc      = 0; // Raw ADC input
  self.scaled   = 0; // Scaled value (mA or V)
  self.reading  = 0; // Translated reading

  self.callback = callback; // Call this function when we have a report

  self.currentReading = null;
  self.lastReading    = null;
  self.lastReportTime = null; // Last time a report was sent

};

AnalogSensor.prototype.log = function(logmsg) {
  var self = this;
  logger.info("[" + self.name + "] " + logmsg);
}

AnalogSensor.prototype.takeReading = function() {
  var self = this;

  // Take ten values, discarding the first two
  var adcs = [];
  var _adc;
  for (var i = 0; i < 10; i++) {
    _adc = self.value();   // Obtain raw ADC from GpioPeripheral
    if (i < 2) continue;
    if (_adc == NaN) continue; // This can happen oddly enough
    adcs.push(_adc);
  }

  _adc = 0; // Average the values
  for (var i = 0; i < adcs.length; i++) {
    _adc = _adc + adcs[i];
  }
  _adc = (_adc / adcs.length).toPrecision(6);

  self.adc = _adc;

  self.scale();            // Scale the reading
  self.translate();        // Translate the reading

  currentReading = {'value':     self.reading,
		    'adc':       self.adc,
		    'timestamp': Date.now()};

  // Evaluate for generation of report
  var report = self.evaluateReading(currentReading);
  console.log(JSON.stringify(report));

//  console.log("last Reading is now set to " + JSON.stringify(self.lastReading));

  if (self.callback) {
    self.callback(null, self.lastReading);
  }
}

// Determine what we should do with this with this reading
// If the reading wasn't demanded, we don't need to send a
// scheduled reading, and the reading
// is not an exception (threshold), then we can toss
//
// There are three types of reports:
// * demand
// * scheduled
// * exception
AnalogSensor.prototype.evaluateReading = function(reading) {
  var self = this;
  // First, check to see if the reading was an exception

  var exceptions = [];

  // was there a delta or deltap change?
  if (self.lastReading) {
    //console.log("calculate for delta and deltap");
    
    var delta = reading.value - self.lastReading.value;
    //console.log("delta = " + Math.abs(delta));

    var deltap = delta / self.lastReading.value;
    //console.log("deltap = " + deltap);

    if (delta >= self.thresholds.delta) {
      console.log("Delta change greater than threshold");
      exceptions.push({"type":"delta",
		       "value":delta});
    }

    if (deltap >= self.thresholds.deltap) {
      exceptions.push({"type":"deltap",
		       "value":deltap});
    }
  }
  
  // Evaluate against lowlow, etc. thresholds
  // Although we can trigger a delta and deltap
  // simultaneously, only one of these will trigger
  if (reading.value <= self.thresholds.lowlow) {
    exceptions.push({"type":"lowlow"});
  } else if (reading.value <= self.thresholds.low) {
    exceptions.push({"type":"low"});
  }

  if (reading.value >= self.thresholds.highhigh) {
    exceptions.push({"type":"highhigh"});
  } else if (reading.value >= self.thresholds.high) {
    exceptions.push({"type":"high"});
  }

  // If there are exceptions then generate an exception 
  // report
  var report = null;
  if (exceptions.length > 0) {
    self.lastReportTime = Date.now();
    report = {"type":"threshold",
	      "timestamp":  self.lastReportTime,
	      "name":self.name,
	      "reading":reading,
	      "exceptions":exceptions};
  } else {
    
    // Or create a scheduled report if we need to
    var sendScheduledReport = false;
    if (self.lastReading) {
      var timeSinceLastReport = reading.timestamp - self.lastReportTime;
      if (timeSinceLastReport > self.reportFrequency * 1000) {
	sendScheduledReport = true;
      }
    } else {
      sendScheduledReport = true;
    }
    
    if (sendScheduledReport) {
      self.lastReportTime = Date.now();
      report = {"type":"scheduled",
		"timestamp":self.lastReportTime,
		"name":self.name,
		"reading":reading};
    }
  }
  
  self.lastReading = reading;
  
  return report;
  
}



AnalogSensor.prototype.scale = function() {
  var self = this;

  if (self.specificType == "420mA") {
    self.scaled = (self.adc/4095) * 20;
  } else if (self.specificType == "05V") {
    self.scaled = (self.adc/4095) * 5;
  } else {
    // Throw an error or something
  }

}

AnalogSensor.prototype.translate = function() {
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

module.exports = AnalogSensor;