var _ = require('lodash');
var util = require('util');
var events = require('events');

var FileDevice = require('../lib/file-device');

var logger = require('../lib/logger')('modem');

function ModemWatcher(config) {
    var self = this;
    self.config = _.defaults(config || {},{
        reportFile:     '/dev/ttyUSB2',
        commandFile:    '/dev/ttyUSB2',
        rssiInterval:   60*1000
    });

    self.device = new FileDevice({inFile: self.config.reportFile,outFile: self.config.commandFile,retryInterval: self.config.retryInterval});
    self.device.on('ready',function(){
        self.interval = setInterval(self.requestRSSICallback,self.config.rssiInterval);
        self.stats.increment('started');
        self.timeout = setTimeout(function(){
            self.timeout = null;
            self.requestIMEI();
            self.requestRSSI();
        },1);
        self.emit('note','ready');
        self.emit('ready');
    });
    self.device.on('retry',function(reason){
        logger.error('start error: ' + reason);
        self.stats.increment('retry');
        self.emit('note','retry');
    });
    self.device.on('error',function(error){
        logger.error('read error: ' + error);
        self.stats.increment('error');
        self.emit('note','error');
    });
    self.device.on('data',function(data){
        _.each(data.split('\n'),function(line){
            if (line.length == 0) return;
            if (self.considerLine(ModemWatcher.Reports.FLOW,line,function(data) { return self.noteFlow(data); })) return;
            if (self.considerLine(ModemWatcher.Reports.RSSI,line,function(data) { return self.noteRSSI(data); })) return;
            self.considerIMEI(line);
        });
        self.emit('note','data');
    });

    self.imeiFound = self.config.imeiFound || function(){};
    self.stats = require('./../lib/statsd-client')('modem'); // NOTE - delay require for mockery testing
    self.requestRSSICallback = function(){ self.requestRSSI(); };
}

util.inherits(ModemWatcher,events.EventEmitter);

ModemWatcher.Reports = Object.freeze({
    FLOW: '^DSFLOWRPT:',    // Huawei format: ^DSFLOWRPT:<curr_ds_time>,<tx_rate>,<rx_rate>,<cu rr_tx_flow>,<curr_rx_flow>,<qos_tx_rate>,<qos_rx_rate>
    RSSI: '+CSQ:'           // Huawei format: +CSQ: <rssi>,<ber>
});

ModemWatcher.prototype.started = function(){
    return this.device.opened();
};

ModemWatcher.prototype.ready = function(){
    return this.device.ready();
};

ModemWatcher.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start watcher');

    var self = this;
    self.imei = null;
    self.imeiCandidates = [];
    self.device.open();
    return self;
};

ModemWatcher.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watcher');

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;

    if (this.interval) clearInterval(this.interval);
    this.interval = null;

    this.stats.increment('stopped');
    this.device.close();
};

ModemWatcher.prototype.considerLine = function(prefix,line,callback){
    return _.startsWith(line,prefix) && callback(line.slice(prefix.length));
};

ModemWatcher.prototype.noteFlow = function(data){
    logger.debug('FLOW: ' + data);

    try {
        var parts = data.split(',');
        this.stats.send({
            txrate: validParseInt(parts[1],16) + '|g',
            rxrate: validParseInt(parts[2],16) + '|g',
            txflow: validParseInt(parts[3],16) + '|g',
            rxflow: validParseInt(parts[4],16) + '|g',
            txqos:  validParseInt(parts[5],16) + '|g',
            rxqos:  validParseInt(parts[6],16) + '|g'
        });
    } catch (e) {
        logger.error('flow error: ' + e);
        this.stats.increment('error');
    }
    return true;
};

ModemWatcher.prototype.noteRSSI = function(data){
    logger.info('RSSI:' + data);

    try {
        var parts = data.split(',');
        this.stats.gauge('rssi',Math.max(validParseInt(parts[0],10),0));
    } catch (e) {
        logger.error('rssi error: ' + e);
        this.stats.increment('error');
    }
    return true;
};

ModemWatcher.prototype.considerIMEI = function(line){
    if (this.imei) return;
    if (this.imeiCandidates.length % 2 === 1 ? line === 'OK' : /^\d{15}$/.test(line)) this.imeiCandidates.push(line);
    if (this.imeiCandidates.length == 4)
        // istanbul ignore else -- unknown how of if the 'unknown' state can be achieved
        if (this.imeiCandidates[0] === this.imeiCandidates[2] &&
            this.imeiCandidates[1] === 'OK' && this.imeiCandidates[3] === 'OK') {
            this.imei = this.imeiCandidates[0];
            logger.info('IMEI: ' + this.imei);
            this.imeiFound(this.imei);
        } else {
            this.imei = 'unknown';
            this.imeiFound(null);
        }
};

ModemWatcher.prototype.requestIMEI = function(){
    this.requestInfo('AT+CGSN\nAT+CGSN\n','imei','imei-request');
};

ModemWatcher.prototype.requestRSSI = function(){
    // NOTE - send AT+CSQ commands instead of relying on ^RSSI events because BER is sent sometimes(?) and BER=0 is ambiguous
    this.requestInfo('AT+CSQ\n','rssi','rssi-request');
};

ModemWatcher.prototype.requestInfo = function(command,event,stat){
    if (!this.ready()) return;

    var self = this;
    self.stats.increment(stat);
    self.device.writeBuffer(command,function(err) {
        if (!err)
            self.emit('note',event);
        else {
            logger.error('request error: ' + err);
            self.stats.increment('error');
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

