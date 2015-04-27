var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');
var HashWatcher = require('./hash-watcher');
var DataReader = require('./data-reader');

var logger = require('../lib/logger')('device');
var builder = require('../lib/device-builder');
var helpers = require('../lib/hash-helpers');
var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/device-hashkeys');

function DeviceRouter(redis,deviceKey){
    var self = this;
    Watcher.apply(this,[logger,{qualifier: deviceKey},true]);
    self.redis = redis;
    self.deviceKey = deviceKey;
    self.queueKey = schema.device.queue.useParam(deviceKey);
    self.messageBase = {routeKey: self.queueKey};
    self.settingsKey = schema.device.settings.useParam(deviceKey);
    self.noteErrorStatus = function(error) { self.noteStatus('error','error(' + self.deviceKey + '):' + error); };
    
    self.on('status',function(status){
        if (!status || !self.device || !self.routeConfig || self.reader) return;

        switch(self.routeConfig.type){
            case 'none':
                return self.noteStatus('off');
            case 'ad-hoc':
                break;
            default:
                return self.noteErrorStatus('unavailable route type: ' + self.routeConfig.type);
        }
        
        self.reader = new DataReader(self.device).start(_.bind(self.readerEvent,self,_)).on('error',self.noteErrorStatus);
        self.noteStatus('ready');
    });

    self.reset();    
    self.settingsWatcher = new HashWatcher(self.settingsKey,hashkeys)
        .addKeysetWatcher('connection',true,self)
        .on('change',function(hash){
            if (!hash) return;
            
            var config = helpers.hash2config(hash,hashkeys.route);
            if (JSON.stringify(config) !== JSON.stringify(self.routeConfig)) {
                self.routeConfig = config;
                self.noteStatus('route');
            }
        })
        .start(self.redis);
}

util.inherits(DeviceRouter,Watcher);

DeviceRouter.prototype.ready = function(){
    return !!this.reader && this.reader.started();
};

DeviceRouter.prototype._onStart = function(config){
    if (this.device = builder.newDevice(config).on('error',this.noteErrorStatus))
        this.noteStatus('device');
    else
        this.noteErrorStatus('unavailable connection type: ' + config.type);
};

DeviceRouter.prototype._onStop = function(){
    this.reset();
    this.noteStatus(null);
};

DeviceRouter.prototype.reset = function(){
    this.device = null;
    this.routeConfig = null;
    if (this.reader && this.reader.started()) this.reader.stop();
    this.reader = null;
};

DeviceRouter.prototype.noteStatus = function(status,info){
    if (status && this.status === 'error') return;
    
    this.emit('status',this.status = status,info || null);
};
    
DeviceRouter.prototype.readerEvent = function(event){
    var self = this;
    switch(self.status){
        case 'ready':
            break;
        case 'pending':
            switch(event){
                case 'ready':
                    return self.noteStatus('ready');
                case 'retry':
                    break;
                default:
                    return self.noteStatus('unexpected reader event(' + self.deviceKey +'): ' + event);
            }
            break;
        default:
            logger.error('ignore reader event(' + self.deviceKey + '): ' + event);
    }
};

DeviceRouter.prototype.noteAck = function(sequenceNumber){
    logger.info('ack(' + this.deviceKey + ') received: ' + sequenceNumber);
};

DeviceRouter.prototype.noteError = function(sequenceNumber){
    logger.info('error(' + this.deviceKey + ') received: ' + sequenceNumber);
};

DeviceRouter.prototype.processQueueEntry = function(entry){
    var self = this;
    logger.info('queue entry(' + self.deviceKey + '): ' + JSON.stringify(entry));
    if (entry && typeof entry === 'object' && entry.command)
        self.reader.submit(entry.command,function(error,command,response){
            if (error)
                logger.error('error(' + self.deviceKey + '): ' + error);
            else
                logger.info('response(' + self.deviceKey + '): ' + response);
            self.redis.lpush(schema.transmit.queue.key,JSON.stringify(_.defaults({},self.messageBase,{
                10: command,
                11: response,
                12: error
            })));
        });
};

module.exports = DeviceRouter;