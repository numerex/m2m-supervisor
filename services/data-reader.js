var _ = require('lodash');
var util = require('util');
var events = require('events');

var logger = require('../lib/logger')('reader');

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
        self.emit('note','retry');
    });
    self.device.on('ready',function(){
        self.emit('note','ready');
        self.emit('ready');
    });
    self.device.on('error',function(error) {
        logger.error('read error: ' + error);
        self.emit('note','error');
    });
    self.device.on('data',function(data){
        var event = 'unknown';
        if (lastData === null && data[0] === self.config.responsePrefix) {
            lastData = data;
            event = 'begin';
        } else if (lastData === null) {
            logger.info('data skipped: ' + data);
            event = 'skip';
        } else {
            lastData += data;
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
        self.emit('note',event);
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
