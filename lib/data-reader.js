var _ = require('lodash');
var util = require('util');

var Watcher = require('./watcher');

var logger = require('./logger')('reader');

function DataReader(peripheral,config) {
    var self = this;
    self.peripheral = peripheral;
    self.config = _.defaults({},config || {},{
        commandPrefix: '',
        commandSuffix: '',
        responsePrefix: '',
        responseSuffix: ''
    });
    _.each(self.config,function(value,key){ self.config[key] = safeEval(value); });
    Watcher.apply(self,[logger,null,true]);
}

util.inherits(DataReader,Watcher);

DataReader.prototype.ready = function(){
    return !!this.peripheral && this.peripheral.ready();
};

DataReader.prototype._onStart = function() {
    var self = this;
    var lastData = null;
    self.peripheral.on('retry',self.retryListener = function(reason) {
        logger.error('retry: ' + reason.message);
        self.emit('note','retry');
        self.emit('retry',reason);
    });
    self.peripheral.on('ready',self.readyListener = function(){
        logger.info('ready');
        self.emit('note','ready');
        self.emit('ready',self);
    });
    self.peripheral.on('error',self.errorListener = function(error) {
        logger.error('read error: ' + error.message);
        self.emit('note','error');
        self.emit('error',error);
    });
    self.peripheral.on('data',self.dataListener = function(data){
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

    self.peripheral.open();
};

DataReader.prototype._onStop = function() {
    this.peripheral.removeListener('retry',this.retryListener);
    this.peripheral.removeListener('ready',this.readyListener);
    this.peripheral.removeListener('error',this.errorListener);
    this.peripheral.removeListener('data',this.dataListener);
    this.peripheral.close();
};

DataReader.prototype.submit = function(command,callback){
    var self = this;
    self.lastCommand = null;
    self.responseCallback = null;
    if (!self.ready())
        callback && callback('not ready',null,null);
    else {
        logger.info('command: ' + JSON.stringify(command));
        self.peripheral.writeBuffer(self.config.commandPrefix + command + self.config.commandSuffix,function(error) {
            if (error) {
                logger.error('write error: ' + error.message);
                callback && callback(error,null,null);
            } else {
                self.lastCommand = command;
                self.responseCallback = callback;
            }
        });
    }
};

function safeEval(string){
    try{
        return string ? eval('"' + string + '"') : '';
    } catch (e){
        logger.error('JSON string contents expected: ' + string);
        return '';
    }
}

module.exports = DataReader;

