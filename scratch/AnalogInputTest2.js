var fs = require('fs');
var AnalogSensor  = require('../lib/analog-sensor');
var SensorFactory = require('../lib/sensor-factory');

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

for (var j = 0; j < sensors.length; j++) {
  var sensor = sensors[j];
  sensor.callback = sensorDataAvailable;
}

function sensorDataAvailable(err, data) {
  console.log("data is available:  " + data.value);
}