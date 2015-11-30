var AnalogSensor = require('./analog-sensor');
//var DigitalSensor = require('./digital-sensor');
//var ModbusSensor  = require('./modbus-sensor');
//var XbeeSensor    = require('./xbee-sensor');

function SensorFactory(sensorjson) {
  var self = this;
  self.sensorjson = sensorjson;
}

SensorFactory.prototype.sensors = function() {
  var self = this;
  self.sensors = [];
  for (var i = 0; i < self.sensorjson.length; i++) {
    var config = self.sensorjson[i];

    sensorName = Object.keys(config)[0];
    sensorType = config[sensorName].type;

    var sensor = null;

    switch (sensorType) {
    case "420mA": sensor = new AnalogSensor(null,config);
      break;
    case "05V":   sensor = new AnalogSensor(null,config);
      break;
    }

    if (sensor) {
      self.sensors.push(sensor);
    }
  }
  return self.sensors;
}

module.exports = SensorFactory;