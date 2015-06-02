var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');
var SerialPeripheral = require('../lib/serial-peripheral');

var logger = require('../lib/logger')('modem');

var MILLIS_PER_SEC = 1000;

function ModemWatcher(config) {
    var self = this;
    Watcher.apply(self,[logger,config,true]);

    self.on('requestRSSI',_.bind(self.requestRSSI,self));
    self.on('ready',function() {
        self.peripheral.writeBuffer('AT E1\r'); // NOTE - this will ensure AT commands are echoed
        self.emit('requestRSSI');
    });
}

util.inherits(ModemWatcher,Watcher);

ModemWatcher.MILLIS_PER_SEC = MILLIS_PER_SEC;

ModemWatcher.Reports = Object.freeze({
    RSSI: '+CSQ:'           // format: +CSQ: <rssi>,<ber>
});

ModemWatcher.prototype.ready = function(){
    return !!this.peripheral && this.peripheral.ready();
};

ModemWatcher.prototype._onStart = function(config) {
    var self = this;
    self.config = config;
    self.peripheral = new SerialPeripheral(_.defaults({retryInterval: self.retryInterval},self.config));
    self.peripheral.on('ready',function(){
        self.interval = setInterval(_.bind(self.emit,self,'requestRSSI'),self.config.rssiInterval * MILLIS_PER_SEC);
        self.emit('note','ready');
        self.emit('ready');
    });
    self.peripheral.on('retry',function(reason){
        logger.error('retry: ' + reason.message);
        self.emit('note','retry');
    });
    self.peripheral.on('error',function(error){
        logger.error('read error: ' + error.message);
        self.emit('note','error');
    });
    self.peripheral.on('data',function(data){
        _.each(data.split('\n'),function(line){
            line = _.trim(line);
            if (line.length == 0) return;
            if (self.considerLine(ModemWatcher.Reports.RSSI,line,_.bind(self.noteRSSI,self,_))) return;
        });
    });

    self.peripheral.open();
};

ModemWatcher.prototype._onStop = function() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;

    this.peripheral.close();
    this.peripheral = null;
};

ModemWatcher.prototype.considerLine = function(prefix,line,callback){
    return _.startsWith(line,prefix) && callback(line.slice(prefix.length));
};

ModemWatcher.prototype.noteRSSI = function(data){
    logger.info('RSSI:' + data);

    try {
        var parts = data.split(',');
        this.emit('rssi',Math.max(validParseInt(parts[0],10),0));
    } catch (e) {
        logger.error('rssi error: ' + e.message);
        this.emit('note','error');
    }
    return true;
};

ModemWatcher.prototype.requestRSSI = function(){
    // NOTE - send AT+CSQ commands instead of relying on ^RSSI events because BER is sent sometimes(?) and BER=0 is ambiguous
    this.requestInfo('AT+CSQ\r','requestRSSI');
};

ModemWatcher.prototype.requestInfo = function(command,event){
    var self = this;
    self.peripheral.writeBuffer(command,function(err) {
        if (!err)
            self.emit('note',event);
        else {
            logger.error('request error: ' + err.message);
            self.emit('note','error');
        }
    });
};

function validParseInt(string,base){
    var result = parseInt(string,base);
    if (isNaN(result)) throw(new Error('invalid value'));
    return result;
}

module.exports = ModemWatcher;

