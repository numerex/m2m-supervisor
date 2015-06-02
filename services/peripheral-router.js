var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');
var CommandScheduler = require('../lib/command-scheduler');
var PeripheralWatcher = require('../lib/peripheral-watcher');
var DataReader = require('../lib/data-reader');
var HashWatcher = require('./hash-watcher');

var logger = require('../lib/logger')('perph-rte');
var helpers = require('../lib/hash-helpers');
var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/peripheral-hashkeys');
var settings = require('../lib/m2m-settings');

function PeripheralRouter(peripheralKey){
    var self = this;
    Watcher.apply(self,[logger,{qualifier: peripheralKey},true]);

    self.busyState = true;
    self.peripheralKey = peripheralKey;
    self.queueKey = schema.peripheral.queue.useParam(peripheralKey);
    self.messageBase = {routeKey: self.queueKey};
    self.settingsKey = schema.peripheral.settings.useParam(peripheralKey);

    self.noteErrorStatus = function(error) {
        var string = 'error(' + self.peripheralKey + ') status: ' + error;
        logger.error(string);
        self.busyState = true;
        self.noteStatus('error',string);
    };

    self.on('status',function(status){
        if (status === 'off') return self.makeReady(true);

        if (!status || !self.peripheral || !self.commands || self.reader) return;

        self.reader = new DataReader(self.peripheral,self.commands)
            .on('error',self.noteErrorStatus)
            .on('ready',function(){ _.defer(_.bind(self.makeReady,self)) });
        self.reader.start();
    });

    self.makeReady = function(busy){
        self.busyState = !!busy;
        if (self.schedule) self.schedule.start(self.client);
        self.noteStatus('ready');
        self.emit('ready',self.ready());
    };

    self.peripheralWatcher = new PeripheralWatcher(self.peripheralKey).on('ready',function(ready){
        if (!ready) {
            if (self.started()) {
                self.reset();
                self.settingsWatcher.emit('checkReady');
            }
        } else if (self.peripheralWatcher.peripheral) {
            self.peripheral = self.peripheralWatcher.peripheral;
            self.noteStatus('peripheral');
        } else {
            self.noteErrorStatus('unavailable connection type: ' + self.peripheralWatcher.config.type);
        }
    });

    self.reset();
    self.settingsWatcher = new HashWatcher(self.settingsKey,hashkeys)
        .addKeysetWatcher('connection',true,self.peripheralWatcher)
        .on('change',function(hash){
            if (!hash) return;
            
            var config = helpers.hash2config(hash,hashkeys.commands);
            if (JSON.stringify(config) !== JSON.stringify(self.commands)) {
                if (self.ready()) self.resetReader();
                switch(config.routing){
                    case 'none':
                        self.commands = null;
                        return self.noteStatus('off');
                    case 'ad-hoc':
                        self.commands = config;
                        self.noteStatus('commands');
                        break;
                    case 'scheduled':
                        if (!config.schedule)
                            self.noteErrorStatus('no schedule defined');
                        else
                            self.client.hgetall(schema.schedule.periods.useParam(config.schedule)).thenHint('getSchedule',function(hash){
                                if (!hash || _.keys(hash).length == 0)
                                    self.noteErrorStatus('empty schedule');
                                else {
                                    self.commands = config;
                                    self.schedule = new CommandScheduler(self.queueKey,hash);
                                    self.noteStatus('commands');
                                }
                            });
                        break;
                    default:
                        self.noteErrorStatus('unavailable command routing: ' + config.routing);
                }
            }
        })
}

util.inherits(PeripheralRouter,Watcher);

PeripheralRouter.prototype.ready = function(){
    return !!this.reader && this.reader.ready();
};

PeripheralRouter.prototype.busy = function(){
    return !this.ready() || this.busyState;
};

PeripheralRouter.prototype._onStart = function(client){
    this.client = client;
    this.settingsWatcher.start(client);
};

PeripheralRouter.prototype._onStop = function(){
    this.busyState = true;
    this.settingsWatcher.stop();
    this.reset();
    this.noteStatus(null);
    this.client = null;
};

PeripheralRouter.prototype.reset = function(){
    this.peripheral = null;
    this.commands = null;
    this.resetReader();
};

PeripheralRouter.prototype.resetReader = function(){
    if (this.ready()) {
        if (this.schedule && this.schedule.started()) this.schedule.stop();
        this.reader.stop();
    }
    this.reader = null;
    this.schedule = null;
    this.busyState = true;
};

PeripheralRouter.prototype.noteStatus = function(status,info){
    this.emit('status',this.status = status,info || null);
};

PeripheralRouter.prototype.noteAck = function(sequenceNumber){
    logger.info('ack(' + this.peripheralKey + ') received: ' + sequenceNumber);
};

PeripheralRouter.prototype.noteError = function(sequenceNumber){
    logger.info('error(' + this.peripheralKey + ') received: ' + sequenceNumber);
};

PeripheralRouter.prototype.processQueueEntry = function(entry){
    var self = this;
    if (!entry || typeof entry !== 'object' || !entry.command)
        logger.error('invalid queue entry(' + self.peripheralKey + '): ' + JSON.stringify(entry));
    else {
        logger.info('queue entry(' + self.peripheralKey + '): ' + JSON.stringify(entry));
        self.busyState = true;
        self.reader.submit(entry.command,function(error,command,response){
            self.busyState = false;
            if (error)
                logger.error('error(' + self.peripheralKey + ') submit: ' + error.message);
            else
                logger.info('response(' + self.peripheralKey + '): ' + JSON.stringify(response));
            var results = {};
            results[settings.ObjectTypes.peripheralCommand]  = command;
            results[settings.ObjectTypes.peripheralResponse] = response;
            results[settings.ObjectTypes.peripheralError]    = error ? error.message : null;
            if (!entry.requestID)
                results.eventCode = settings.EventCodes.peripheralSchedule;
            else {
                results.eventCode = settings.EventCodes.peripheralCommand;
                results[settings.ObjectTypes.requestID] = entry.requestID;
            }
            self.client.lpush(entry.destination || schema.transmit.queue.key,JSON.stringify(_.defaults({},self.messageBase,results))).errorHint('lpush');
        });
    }
};

module.exports = PeripheralRouter;