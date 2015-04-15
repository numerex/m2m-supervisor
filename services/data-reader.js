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
        responseSuffix: '\x03'
    });
}

ModemWatcher.prototype.started = function(){
    return this.device.opened();
};

ModemWatcher.prototype.ready = function(){
    return this.device.ready();
};

DataReader.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start reader');

    var self = this;
    self.noteEvent = note || function(){};
    self.device.open(function(event,reason){
        switch(event){
            case 'ready':
                self.buffer = new Buffer(64 * 1024);
                self.noteEvent('ready');
                break;
            case 'retry':
                logger.error('start error: ' + reason);
                self.noteEvent('retry');
                break;
        }
    });
    return self;
};

DataReader.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop reader');

    this.stats.increment('stopped');
    this.device.close();
};

module.exports = DataReader;

