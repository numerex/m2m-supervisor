var _ = require('lodash');

var TelnetDevice = require('../lib/telnet-device');
var DataReader = require('./data-reader');

var logger = require('../lib/logger')('device');
var helpers = require('../lib/hash-helpers');
var schema = require('../lib/redis-schema');

function DeviceRouter(redis,deviceKey,note){
    var self = this;
    self.redis = redis;
    self.deviceKey = deviceKey;
    self.queueKey = schema.device.queue.useParam(deviceKey);
    self.settingsKey = schema.device.settings.useParam(deviceKey);
    self.noteStatus = note || function(){};

    self.status = 'pending';
    self.redis.hgetall(self.settingsKey,function(err,hash){
        if (err)
            self.noteStatus(self.status = 'error',err);
        else {
            self.connectionConfig = helpers.hash2config(hash.connection);
            switch(self.connectionConfig.type){
                case 'telnet':
                    self.device = new TelnetDevice({host: self.connectionConfig.telnetAddress,port: self.connectionConfig.telnetPort})
                    break;
                default:
                    return self.noteStatus(self.status = 'error','unavailable connection type(' + self.deviceKey +'): ' + self.connectionConfig.type)
            }
            self.routeConfig = helpers.hash2config(hash.route);
            switch(self.routeConfig.type){
                case 'none':
                    return self.noteStatus(self.status = 'off');
                case 'ad-hoc':
                    break;
                default:
                    return self.noteStatus(self.status = 'error','unavailable route type(' + self.deviceKey +'): ' + self.routeConfig.type)
            }
            self.reader = new DataReader(self.device).start(_.bind(self.readerEvent,self,_));
        }
    })
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
            logger.error(' ingore reader event(' + self.deviceKey + '): ' + event);
    }
};

DeviceRouter.prototype.noteAck = function(sequenceNumber){
    if (this.status !== 'ready')
        logger.error('ack(' + self.deviceKey + ') status not ready: ' + self.status);
    else {
        logger.info('ack(' + self.deviceKey + ') received');
    }
};

DeviceRouter.prototype.processQueueEntry = function(entry){
    var self = this;
    logger.info('queue entry(' + self.deviceKey + '): ' + entry);
    entry = JSON.parse(entry);
    if (entry.command) {
        self.reader.submit(entry.command,function(error,command,response){
            if (error)
                logger.error('queue entry(' + self.deviceKey + '): ' + error);
            else {
                logger.info('response(' + self.deviceKey + '): ' + response);
            }
        });
    }
};


module.exports = DeviceRouter;