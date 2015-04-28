var _ = require('lodash');
var util = require('util');

var Watcher = require('./watcher');

var logger = require('./logger')('reader');

function DataReader(device,config) {
    var self = this;
    self.config = _.defaults(config || {},{
        commandPrefix: '\x01',
        commandSuffix: '\x03',
        responsePrefix: '\x01',
        responseSuffix: '\x03'
    });
    Watcher.apply(this,[logger,null,true]);

    var lastData = null;
    self.device = device;
    self.device.on('retry',function(reason) {
        logger.error('start error: ' + reason);
        self.emit('note','retry');
        self.emit('retry',reason);
    });
    self.device.on('ready',function(){
        self.emit('note','ready');
        self.emit('ready');
    });
    self.device.on('error',function(error) {
        logger.error('read error: ' + error);
        self.emit('note','error');
        self.emit('error',error);
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

util.inherits(DataReader,Watcher);

DataReader.prototype.ready = function(){
    return !!this.device && this.device.ready();
};

DataReader.prototype._onStart = function() {
    this.device.open();
};

DataReader.prototype._onStop = function() {
    this.device.close();
};

DataReader.prototype.submit = function(command,callback){
    var self = this;
    self.lastCommand = null;
    self.responseCallback = null;
    if (!self.ready())
        callback && callback('not ready',null,null);
    else {
        logger.info('command: ' + JSON.stringify(command));
        self.device.writeBuffer(self.config.commandPrefix + command + self.config.commandSuffix,function(error) {
            if (error) {
                logger.error('write error: ' + error);
                callback && callback(error,null,null);
            } else {
                self.lastCommand = command;
                self.responseCallback = callback;
            }
        });
    }
};

module.exports = DataReader;

