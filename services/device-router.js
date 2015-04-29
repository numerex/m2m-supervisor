var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');
var DeviceWatcher = require('../lib/device-watcher');
var DataReader = require('../lib/data-reader');
var HashWatcher = require('./hash-watcher');

var logger = require('../lib/logger')('dev-route');
var helpers = require('../lib/hash-helpers');
var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/device-hashkeys');

function DeviceRouter(deviceKey){
    var self = this;
    Watcher.apply(self,[logger,{qualifier: deviceKey},true]);
    self.deviceKey = deviceKey;
    self.queueKey = schema.device.queue.useParam(deviceKey);
    self.messageBase = {routeKey: self.queueKey};
    self.settingsKey = schema.device.settings.useParam(deviceKey);
    self.noteErrorStatus = function(error) { self.noteStatus('error','error(' + self.deviceKey + '):' + error); };
    
    self.on('status',function(status){
        if (!status || !self.device || !self.routeConfig || self.reader) return;

        self.reader = new DataReader(self.device)
            .on('error',self.noteErrorStatus)
            .start();
        _.defer(function(){
            self.noteStatus('ready');
            self.emit('ready',self.ready());
        });
    });

    self.deviceWatcher = new DeviceWatcher(self.deviceKey).on('ready',function(ready){
        if (!ready) {
            if (self.started()) {
                self.reset();
                self.settingsWatcher.checkReady();
            }
        } else if (self.deviceWatcher.device) {
            self.device = self.deviceWatcher.device.on('error',self.noteErrorStatus);
            self.noteStatus('device');
        } else {
            self.noteErrorStatus('unavailable connection type: ' + self.deviceWatcher.config.type);
        }
    });

    self.reset();
    self.settingsWatcher = new HashWatcher(self.settingsKey,hashkeys)
        .addKeysetWatcher('connection',true,self.deviceWatcher)
        .on('change',function(hash){
            if (!hash) return;
            
            var config = helpers.hash2config(hash,hashkeys.route);
            if (JSON.stringify(config) !== JSON.stringify(self.routeConfig)) {
                if (self.ready()) self.resetReader();
                switch(config.type){
                    case 'none':
                        return self.noteStatus('off');
                    case 'ad-hoc':
                        self.routeConfig = config;
                        self.noteStatus('route');
                        break;
                    default:
                        return self.noteErrorStatus('unavailable route type: ' + config.type);
                }
            }
        })
}

util.inherits(DeviceRouter,Watcher);

DeviceRouter.prototype.ready = function(){
    return !!this.reader && this.reader.started();
};

DeviceRouter.prototype._onStart = function(client){
    this.client = client;
    this.settingsWatcher.start(client);
};

DeviceRouter.prototype._onStop = function(){
    this.settingsWatcher.stop();
    this.reset();
    this.noteStatus(null);
    this.client = null;
};

DeviceRouter.prototype.reset = function(){
    this.device = null;
    this.routeConfig = null;
    this.resetReader();
};

DeviceRouter.prototype.resetReader = function(){
    if (this.ready()) this.reader.stop();
    this.reader = null;
};

DeviceRouter.prototype.noteStatus = function(status,info){
    //if (status && this.status === 'error') return; TODO - do we need this?
    
    this.emit('status',this.status = status,info || null);
};

DeviceRouter.prototype.noteAck = function(sequenceNumber){
    logger.info('ack(' + this.deviceKey + ') received: ' + sequenceNumber);
};

DeviceRouter.prototype.noteError = function(sequenceNumber){
    logger.info('error(' + this.deviceKey + ') received: ' + sequenceNumber);
};

DeviceRouter.prototype.processQueueEntry = function(entry){
    var self = this;
    if (!entry || typeof entry !== 'object' || !entry.command)
        logger.error('invalid queue entry(' + self.deviceKey + '): ' + JSON.stringify(entry));
    else {
        logger.info('queue entry(' + self.deviceKey + '): ' + JSON.stringify(entry));
        self.reader.submit(entry.command,function(error,command,response){
            if (error)
                logger.error('error(' + self.deviceKey + '): ' + error);
            else
                logger.info('response(' + self.deviceKey + '): ' + JSON.stringify(response));
            self.client.lpush(schema.transmit.queue.key,JSON.stringify(_.defaults({},self.messageBase,{
                10: command,
                11: response,
                12: error
            }))).errorHint('lpush');
        });
    }
};

module.exports = DeviceRouter;