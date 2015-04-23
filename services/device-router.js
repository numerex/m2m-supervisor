var _ = require('lodash');

var ConfigCheckpoint = require('./config-checkpoint');
var DataReader = require('./data-reader');

var logger = require('../lib/logger')('device');
var builder = require('../lib/device-builder');
var helpers = require('../lib/hash-helpers');
var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/device-hashkeys');

function DeviceRouter(redis,deviceKey,note){
    var self = this;
    self.redis = redis;
    self.deviceKey = deviceKey;
    self.queueKey = schema.device.queue.useParam(deviceKey);
    self.messageBase = {routeKey: self.queueKey};
    self.settingsKey = schema.device.settings.useParam(deviceKey);
    self.noteStatus = note || function(){};

    self.status = 'pending';
    self.connectionChk = new ConfigCheckpoint(redis,self.settingsKey,hashkeys.connection,helpers.requirements(hashkeys.connection)).start(function(connectionEvent,connectionConfig){
        if (connectionEvent !== 'ready') return;

        if (!(self.device = builder.newDevice(connectionConfig)))
            return self.noteStatus(self.status = 'error','unavailable connection type(' + self.deviceKey +'): ' + connectionConfig.type);

        self.routeChk = new ConfigCheckpoint(redis,self.settingsKey,hashkeys.route,helpers.requirements(hashkeys.route)).start(function(routeEvent,routeConfig){
            if (routeEvent !== 'ready') return;

            switch(routeConfig.type){
                case 'none':
                    return self.noteStatus(self.status = 'off');
                case 'ad-hoc':
                    break;
                default:
                    return self.noteStatus(self.status = 'error','unavailable route type(' + self.deviceKey +'): ' + routeConfig.type)
            }
            self.reader = new DataReader(self.device).start(_.bind(self.readerEvent,self,_));
            self.noteStatus(self.status = 'ready');
        });
    });
}

DeviceRouter.prototype.readerEvent = function(event){
    var self = this;
    switch(self.status){
        case 'ready':
            break;
        case 'pending':
            switch(event){
                case 'ready':
                    return self.noteStatus(self.status = 'ready');
                case 'retry':
                    break;
                default:
                    return self.noteStatus(self.status = 'error','unexpected reader event(' + self.deviceKey +'): ' + event);
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