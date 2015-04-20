var _ = require('lodash');
var util = require('util');
var events = require('events');

var logger = require('./../lib/logger')('data-rdr');

function DataReader(device,config) {
    var self = this;
    self.config = _.defaults(config || {},{
        commandPrefix: '\x01',
        commandSuffix: '\x03',
        responsePrefix: '\x01',
        responseSuffix: '\x03'
    });

    var lastData = null;
    self.device = device;
    self.device.on('retry',function(reason) {
        logger.error('start error: ' + reason);
        self.emit('retry');
    });
    self.device.on('ready',function(){
        self.emit('ready');
    });
    self.device.on('retry',function(error) {
        logger.error('read error: ' + error);
        self.emit('error');
    });
    self.device.on('data',function(data){
        var event = 'unknown';
        if (lastData === null && value[0] === self.config.responsePrefix) {
            lastData = value;
            event = 'begin';
        } else if (lastData === null) {
            logger.info('data skipped: ' + value);
            event = 'skip';
        } else {
            lastData += value;
            event = 'middle';
        }
        if (lastData && lastData[lastData.length - 1] === self.config.responseSuffix) {
            logger.info('response: ' + JSON.stringify(lastData));
            self.responseCallback && self.responseCallback(null,self.lastCommand,lastData);
            lastData = null;
            self.lastCommand = null;
            self.responseCallback = null;
            event = 'response';
        }
        self.emit(event);
    });
}

util.inherits(DataReader,events.EventEmitter);

DataReader.prototype.started = function(){
    return this.device.opened();
};

DataReader.prototype.ready = function(){
    return this.device.ready();
};

DataReader.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start reader');

    var self = this;
    self.device.open();
    return self;
};

DataReader.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop reader');

    this.device.close();
};

DataReader.prototype.submit = function(command,callback){
    var self = this;
    self.lastCommand = null;
    self.responseCallback = null;
    if (!self.ready())
        callback && callback('error','not ready');
    else
        logger.info('command: ' + JSON.stringify(command));
        self.device.writeBuffer(self.config.commandPrefix + command + self.config.commandSuffix,function(error) {
            if (error)
                callback && callback('error',error);
            else {
                self.lastCommand = command;
                self.responseCallback = callback;
            }
        });
};

module.exports = DataReader;

