var _ = require('lodash');
var fs = require('fs');
var logger = require('./logger')('modem');

function ModemWatcher(config) {
    var self = this;
    self.config = _.defaults(config || {},{
        reportFile:     '/dev/ttyUSB2',
        commandFile:    '/dev/ttyUSB2',
        rssiInterval:   60*1000
    });
    self.imeiFound = self.config.imeiFound || function(){};
    self.stats = require('./statsd-client')('modem'); // NOTE - delay require for mockery testing
    self.attemptStartCallback = function(){ self.attemptStart(); };
    self.readEventsCallback = function(){ self.readEvents(); };
    self.requestIMEICallback = function(){ self.requestIMEI(); };
    self.requestRSSICallback = function(){ self.requestRSSI(); };
}

ModemWatcher.Reports = Object.freeze({
    FLOW: '^DSFLOWRPT:',    // Huawei format: ^DSFLOWRPT:<curr_ds_time>,<tx_rate>,<rx_rate>,<cu rr_tx_flow>,<curr_rx_flow>,<qos_tx_rate>,<qos_rx_rate>
    RSSI: '+CSQ:'           // Huawei format: +CSQ: <rssi>,<ber>
});

ModemWatcher.prototype.started = function(){
    return !!this.startCalled;
};

ModemWatcher.prototype.ready = function(){
    return !!this.fdin;
};

ModemWatcher.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start watcher');

    var self = this;
    self.startCalled = true;
    self.imei = null;
    self.imeiCandidates = [];
    self.noteEvent = note || function(){};
    self.attemptStart();
    return self;
};

ModemWatcher.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watcher');
    this.stats.increment('stopped');

    if (this.interval) clearInterval(this.interval);
    if (this.fdin) fs.close(this.fdin);
    this.fdin = null;

    this.startCalled = false;
};

ModemWatcher.prototype.attemptStart = function(){
    if (!this.started()) return; // NOTE - abort when stopped after failed start

    var self = this;
    try {
        self.fdin = fs.openSync(self.config.reportFile,'r');
        self.buffer = new Buffer(64 * 1024);
        setTimeout(self.requestIMEICallback,1);
        setTimeout(self.readEventsCallback,1);
        setTimeout(self.requestRSSICallback,1);
        self.interval = setInterval(self.requestRSSICallback,self.config.rssiInterval);
        self.stats.increment('started');
        self.noteEvent('ready');
    } catch(e) {
        logger.error('start error: ' + e);
        self.stats.increment('retry');
        setTimeout(self.attemptStartCallback,self.config.rssiInterval);
        self.noteEvent('retry');
    }
};

ModemWatcher.prototype.readEvents = function() {
    if (!this.started()) return;

    var self = this;
    fs.read(self.fdin,self.buffer,0,self.buffer.length,null,function(err,length,position){
        // istanbul ignore if -- too difficult to make read fail after successful open
        if (err) {
            logger.error('read error: ' + err);
            self.stats.increment('error');
        }
        else if (self.started()) {
            _.each(self.buffer.toString(null,0,length).split('\n'),function(line){
                if (line.length == 0) return;
                if (self.considerLine(ModemWatcher.Reports.FLOW,line,function(data) { return self.noteFlow(data); })) return;
                if (self.considerLine(ModemWatcher.Reports.RSSI,line,function(data) { return self.noteRSSI(data); })) return;
                self.considerIMEI(line);
            });
        } else {
            return;
        }
        setTimeout(self.readEventsCallback,1); // TODO - is there a better way to do this?
        self.noteEvent('report');
    });
};

ModemWatcher.prototype.considerLine = function(prefix,line,callback){
    return _.startsWith(line,prefix) && callback(line.slice(prefix.length));
};

ModemWatcher.prototype.noteFlow = function(data){
    logger.info('FLOW: ' + data);

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
    this.requestInfo('AT+CSQ\n','rssi','rssi-request');
};

ModemWatcher.prototype.requestInfo = function(command,event,stat){
    if (!this.ready()) return;

    var self = this;
    try {
        self.stats.increment(stat);

        // NOTE - send AT+CSQ commands instead of relying on ^RSSI events because BER is sent sometimes(?) and BER=0 is ambiguous
        var fdout = fs.openSync(self.config.commandFile,'w');
        fs.write(fdout,command,null,null,function(err,written,string) {
            // istanbul ignore if -- too difficult to make write fail after successful open
            if (err) {
                logger.error('write error: ' + err);
                self.stats.increment('error');
            }

            fs.close(fdout);
            self.noteEvent(event);
        });
    } catch (e) {
        logger.error('request error: ' + e);
        self.stats.increment('error');
        self.noteEvent('error');
    }
};

function validParseInt(string,base){
    var result = parseInt(string,base);
    if (isNaN(result)) throw(new Error('invalid value'));
    return result;
}

module.exports = ModemWatcher;

