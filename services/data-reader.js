var _ = require('lodash');
var logger = require('./../lib/logger')('data-rdr');

function DataReader(device,config) {
    var self = this;
    self.device = device;
    self.config = _.defaults(config || {},{
        commandPrefix: '\x01',
        commandSuffix: '\x03',
        responsePrefix: '\x01',
        responseSuffix: '\x03'
    });
}

DataReader.prototype.started = function(){
    return this.device.opened();
};

DataReader.prototype.ready = function(){
    return this.device.ready();
};

DataReader.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start reader');

    var self = this;
    var lastData = null;
    self.noteEvent = note || function(){};
    self.device.open(function(event,value){
        switch(event){
            case 'ready':
                break;
            case 'retry':
                logger.error('start error: ' + value);
                break;
            case 'error':
                logger.error('read error: ' + value);
                break;
            case 'data':
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
                break;
        }
        self.noteEvent(event);
    });
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

