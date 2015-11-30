var fs = require('fs');
//var log = require('./bunyan-logger');
var AnalogSensor  = require('../lib/analog-sensor');
var SensorFactory = require('../lib/sensor-factory');
var Table = require('cli-table');

var configFile = process.argv[2];

console.log("Loading sensor configuration from " + configFile);

try {
  var sensorConfig  = JSON.parse(fs.readFileSync(configFile,"utf8"));
} catch (ex) {
  console.log("Could not load configuration from " + configFile);
  process.exit(-1);
}
var sensorFactory = new SensorFactory(sensorConfig);
var sensors       = sensorFactory.sensors();

function readInputs() {
  var table = new Table({
    head: ['Name','Type','Input','Scaled','Reading'],
    colWidths:[18, 12, 12, 12, 14]
  });
  
  for (var j = 0; j < sensors.length; j++) {
    
    var sensor = sensors[j];
    
    sensor.takeReading();
    
    table.push([
      sensor.name,
      sensor.specificType,
      sensor.adc,
      sensor.scaled.toPrecision(4),
      sensor.reading.toPrecision(4) + " " + sensor.units
    ]);
    
  }
  
  console.log(table.toString());
};

readInputs();
process.exit();