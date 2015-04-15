var _ = require('lodash');
var fs = require('fs');
var logger = require('./../lib/logger')('data-rdr');

function DataReader(device,config) {
    var self = this;
    self.device = device;
    self.config = _.defaults(config || {},{
        queueKey: 'm2m-device:queue',
        commandPrefix: '\x01',
        commandSuffix: '\x03',
        responsePrefix: '\x01',
        responseSuffix: '\x03',
        retryInterval:  15*1000
    });
    self.attemptStartCallback = function(){ self.attemptStart(); };
}

DataReader.prototype.started = function(){
    return !!this.startCalled;
};

DataReader.prototype.ready = function(){
    return false; // TODO
};

DataReader.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start reader');

    var self = this;
    self.startCalled = true;
    self.noteEvent = note || function(){};
    self.attemptStart();
    return self;
};

DataReader.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watcher');

    this.startCalled = false;
};

DataReader.prototype.attemptStart = function(){
    if (!this.started()) return; // NOTE - abort when stopped after failed start

    var self = this;
    try {
        self.noteEvent('ready');
    } catch(e) {
        logger.error('start error: ' + e);
        setTimeout(self.attemptStartCallback,self.config.retryInterval);
        self.noteEvent('retry');
    }
};

module.exports = DataReader;

