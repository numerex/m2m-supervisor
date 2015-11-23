var _ = require('lodash');
var util = require('util');
var events = require('events');

var logger = require('./logger')('sys-chk');

// JB: qmilib does not use any of these
// v--
var COMMAND_SUFFIX  = '\r';
var PORT_DIRECTORY  = '/dev/serial/by-id/';
var COMMAND_LIST    = [
    ['vendor',  'AT+CGMI',''],
    ['model',   'AT+CGMM',''],
    ['version', 'AT+CGMR',''],
    ['imsi',    'AT+CIMI',''],
    ['imei',    'AT+CGSN',''],
    ['rssi',    'AT+CSQ','']
];
// ^--

var MODEM_PROPERTIES = [
  'vendor',
  'model',
  'version',
  'imsi',
  'imei',
  'rssi'
];

function SystemChecker(config){
    config = config || {};

    var self = this;
    self.timeoutInterval = config.timeoutInterval || 1000;
    self.verbose = !!config.verbose;
    self.fs = require('fs');                                    // NOTE delayed for testing
    self.shell = require('shelljs');                            // NOTE delayed for testing
    self.SerialPeripheral = require('./serial-peripheral');     // NOTE delayed for testing
    self.reset();
    self.on('check',function(item,value){
      if (self.verbose) logger.info('check:' + item + ' ' + value);
      if (++self.resultCount === self.expectCount) {
	self.collectModemInfo(_.bind(self.emit,self,'ready'));
      }
    });
}

util.inherits(SystemChecker,events.EventEmitter);

SystemChecker.prototype.reset = function(){
    this.exists = {};
    this.choices = {};
    this.info = {};
    this.allPorts = [];
};

SystemChecker.prototype.checkNow = function(){
  this.expectCount = 3;
  this.resultCount = 0;
  this.checkProgram('pm2');
  this.checkProgram('redis','redis-cli');
  this.checkProgram('ntpd');
  return this;
};

SystemChecker.prototype.checkFile = function(label,filename){
    var self = this;
    self.info[label] = 'unknown';
    self.fs.readFile(filename,function(error,data){
        if (error)
            self.info[label] = 'file error: ' + error.message;
        else
            self.info[label] = _.trim(data.toString());
        self.emit('check',label,data);
    });
};

SystemChecker.prototype.checkProgram = function(label,executable){
    var self = this;
    executable = executable || label;
    self.exists[label] = 'unknown';
    self.shell.exec('which ' + executable,{silent: true},function(code,output) {
        self.exists[label] = code === 0 ? 'OK' : 'missing';
        self.emit('check',label,self.exists[label]);
    });
};

// JB:  not used by qmi modem
SystemChecker.prototype.findSerialPorts = function(callback){
    var self = this;
    self.fs.readdir(PORT_DIRECTORY,function(error,files){
        if (self.verbose && error) logger.info('find error: ' + error.message);
        self.allPorts = _.map(files,function(name){ return PORT_DIRECTORY + name; });
        callback && callback();
    });
};

// JB:  not used by qmi modem
SystemChecker.prototype.chooseBestPorts = function(){
    var self = this;
    self.choices.dataPort = null;
    self.choices.controlPort = null;
    var remainingPorts = self.allPorts.slice();

    function findBest(key,callback){
        var choice = remainingPorts.shift();
        if (self.verbose) logger.info('key:' + key + ' choice:' + choice);
        if (!choice) {
            self.emit('check',key,null);
            callback && callback();
        } else {
            var peripheral = new self.SerialPeripheral({serialPort: choice,serialBaudRate: 460800});
            var timeout = setTimeout(done,self.timeoutInterval);

            function done(){
                timeout && clearTimeout(timeout);
                timeout = null;

                peripheral && peripheral.close();
                peripheral = null;

                if (key)
                    findBest(key,callback);
                else {
                    callback && callback();
                    callback = null;
                }
            }

            peripheral.on('error',function(error){ if (self.verbose) logger.info('find error: ' + error.message); done(); });
            peripheral.on('retry',function(error){ if (self.verbose) logger.info('find retry: ' + error.message); done(); });

            peripheral.on('data',function(data){
                if (self.verbose) logger.info('data:' + data);
                if (/OK/.test(data.toString())){
                    self.choices[key] = choice;
                    self.emit('check',key,choice);
                    key = null;
                }
                done();
            });

            peripheral.on('ready',function(){
                if (self.verbose) logger.info('ready: ' + choice);
                peripheral.writeBuffer('AT' + COMMAND_SUFFIX);
            });

            peripheral.open();
        }
    }

    findBest('dataPort',function(){ findBest('controlPort'); });

};

SystemChecker.prototype.collectModemInfo = function(){

  var self = this;
  
  var QmiModem = require('./qmi-modem');
  
  var modem    = new QmiModem({verbose:self.verbose});
  
  modem.on('ready', function() {
    _.each(MODEM_PROPERTIES, function(property) {
      self.info[property] = modem[property];
    });
    self.emit('ready');
  });
  
  modem.check();

};

module.exports = SystemChecker;
