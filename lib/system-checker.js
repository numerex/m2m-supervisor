var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var events = require('events');

var SerialPeripheral = require('./serial-peripheral');

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

function SystemChecker(verbose){
    var self = this;
    self.verbose = !!verbose;
    self.shell = require('shelljs');
    self.reset();
    self.on('check',function(item,value){
        if (self.verbose) console.log('check:' + item + ' ' + value);
        if (++self.resultCount === self.expectCount) self.collectModemInfo(_.bind(self.emit,self,'ready'));
    })
}

util.inherits(SystemChecker,events.EventEmitter);

SystemChecker.prototype.reset = function(){
    this.exists = {};
    this.choices = {};
    this.info = {};
    this.allPorts = [];
};

SystemChecker.prototype.checkNow = function(){
    this.expectCount = 7;
    this.resultCount = 0;
    this.checkFile('debian','/etc/dogtag');
    this.checkProgram('pm2');
    this.checkProgram('redis','redis-cli');
    this.checkProgram('pppd');
    this.checkProgram('ntpd');
    this.findSerialPorts(_.bind(this.chooseBestPorts,this)); // NOTE +2 expected checks
    return this;
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

SystemChecker.prototype.checkFile = function(label,filename){
    var self = this;
    filename = filename || label;
    self.info[label] = 'unknown';
    fs.readFile(filename,function(error,data){
        if (error)
            self.info[label] = 'error:' + error;
        else
            self.info[label] = _.trim(data.toString());
        self.emit('check',label,data);
    });
};

SystemChecker.prototype.findSerialPorts = function(callback){
    var self = this;
    fs.readdir(PORT_DIRECTORY,function(error,files){
        if (self.verbose && error) console.log('find error:' + error);
        self.allPorts = _.map(files,function(name){ return PORT_DIRECTORY + name; });
        callback && callback();
    });
};

SystemChecker.prototype.chooseBestPorts = function(){
    var self = this;
    self.choices['dataPort'] = null;
    self.choices['controlPort'] = null;
    var remainingPorts = self.allPorts.slice();

    function findBest(key,callback){
        var choice = remainingPorts.shift();
        if (self.verbose) console.log('key:' + key + ' choice:' + choice);
        if (!choice) {
            self.emit('check',key,null);
            callback && callback();
        } else {
            var peripheral = new SerialPeripheral({serialPort: choice,serialBaudRate: 460800});
            var timeout = setTimeout(done,1000);

            function done(){
                if (timeout) clearTimeout(timeout);
                timeout = null;

                if (peripheral) peripheral.close();
                peripheral = null;

                if (key)
                    findBest(key,callback);
                else {
                    callback && callback();
                    callback = null;
                }
            }

            peripheral
                .on('retry',function(reason){ if (self.verbose) console.log('retry:' + reason); done(); })
                .on('error',function(error){ if (self.verbose) console.log('error:' + error); done(); })
                .on('data',function(data){
                    if (self.verbose) console.log('data:' + data);
                    if (/OK/.test(data.toString())){
                        self.choices[key] = choice;
                        self.emit('check',key,choice);
                        key = null;
                    }
                    done();
                })
                .on('ready',function(){
                    if (self.verbose) console.log('ready');
                    peripheral.writeBuffer('AT' + COMMAND_SUFFIX,function(error){ if (error) done(); });
                })
                .open();
        }
    }

    findBest('dataPort',function(){ findBest('controlPort'); });

};

SystemChecker.prototype.collectModemInfo = function(){
    var self = this;
    if (!self.choices.dataPort) return self.emit('ready');
    
    var callback = null;
    var peripheral = new SerialPeripheral({serialPort: self.choices.dataPort,serialBaudRate: 460800});
    peripheral
        .on('data',function(data){
            _.each(data.toString().split('\n'),function(line){
                line = _.trim(line);
                if (self.verbose) console.log('line:' + line);
                if (line.length > 0 && callback) callback(line);
            });
        })
        .on('error',function(error){
            console.log('modem error: ' + error);
            process.exit(1);
        })
        .on('retry',function(error){
            console.log('modem retry: ' + error);
            process.exit(1);
        })
        .on('ready',function(){
            var index = -1;

            peripheral.writeBuffer('AT E1' + COMMAND_SUFFIX); // NOTE - ensure that commands are echoed

            function nextCommand(){
                if (++index < COMMAND_LIST.length)
                    sendExpect(COMMAND_LIST[index][0],COMMAND_LIST[index][1],COMMAND_LIST[index][2],nextCommand);
                else {
                    peripheral.close();
                    self.emit('ready');
                }
            }

            nextCommand();
        })
        .open();

    function sendExpect(label,command,prefix,done){
        var commandSeen = null;
        var prefixSeen = null;
        if (self.verbose) console.log('command: ' + command);
        callback = function(data){
            var check = '';
            if (!commandSeen && data === command) {
                commandSeen = command;
                check = ' - command';
            } else if (commandSeen && !prefixSeen && _.startsWith(data,prefix)) {
                prefixSeen = data;
                check = ' - match';
            }
            if (self.verbose) console.log('data: ' + data + check);
            if (data === 'OK' && commandSeen && prefixSeen) {
                if (self.verbose) console.log('result:' + commandSeen + ' => ' + prefixSeen);
                self.info[label] = prefixSeen;
                callback = null;
                done && done();
            }
        };
        peripheral.writeBuffer(command + COMMAND_SUFFIX,function(error){
            if (error) console.log('callback error: ' + error);
        });
    }
    
};

module.exports = SystemChecker;
