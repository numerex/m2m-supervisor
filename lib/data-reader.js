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
        responseSuffix: '',
        timeoutInterval: 5*1000
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
            self.resetTimeout();
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
    this.resetTimeout();
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
        callback && callback(new Error('not ready'),command,null);
    else {
        logger.info('command: ' + JSON.stringify(command));
        self.peripheral.writeBuffer(self.config.commandPrefix + command + self.config.commandSuffix,function(error) {
            if (error) {
                logger.error('write error: ' + error.message);
                callback && callback(error,command,null);
            } else {
                self.lastCommand = command;
                self.responseCallback = callback;
                self.timeout = setTimeout(function(){
                    self.lastCommand = null;
                    self.responseCallback = null;
                    logger.error('timeout');
                    callback && callback(new Error('timeout'),command,null);
                },self.config.timeoutInterval);
            }
        });
    }
};

DataReader.prototype.resetTimeout = function(){
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
};

function safeEval(value){
    try{
        return typeof value === 'number' ? value : value ? eval('"' + value + '"') : '';
    } catch (e){
        logger.error('JSON string contents expected: ' + value);
        return '';
    }
}

module.exports = DataReader;

