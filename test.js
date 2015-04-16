var TelnetDevice = require('./lib/telnet-device');
var DataReader = require('./services/data-reader');

var device = new TelnetDevice({host: 'localhost',port: 10001});
var dataReader = new DataReader(device).start(function(event) { console.log('event: ' + event)});

dataReader.submit('I11100',function(error,command,response){
    console.log('error:' + error);
    console.log('command:' + command);
    console.log('response:' + response);
    dataReader.stop();
});