var _ = require('lodash');
var m2m = require('m2m-ota-javascript');
var util = require('util');

var Watcher = require('../lib/watcher');
var UdpListener = require('../lib/udp-listener');

var logger = require('../lib/logger')('router');
var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

var ACK_PENDING_QUEUE_KEYS = Object.freeze([
    schema.ack.queue.key,
    schema.command.queue.key
]); 

var COMMON_QUEUE_KEYS = Object.freeze([
    schema.ack.queue.key,
    schema.command.queue.key,
    schema.transmit.queue.key
]);

var ACK_STATE_KEYS = Object.freeze([
    schema.ack.message.key,
    schema.ack.routeKey.key,
    schema.ack.retries.key,
    schema.ack.ticks.key,
    schema.ack.sequenceNumber.key
]);

QueueRouter.ACK_STATE_KEYS = ACK_STATE_KEYS;

function getAckState(values){
    return {
        message:        values[0],
        routeKey:       values[1],
        retries:        values[2] || '0',
        ticks:          values[3] || '0',
        sequenceNumber: values[4] || '0'
    }
}

function ackStatePairs(message,routeKey) {
    return [
        ACK_STATE_KEYS[0],JSON.stringify(message),
        ACK_STATE_KEYS[1],routeKey,
        ACK_STATE_KEYS[2],0,
        ACK_STATE_KEYS[3],0,
        ACK_STATE_KEYS[4],message.sequenceNumber
    ];
}

function QueueRouter(config) {
    var self = this;
    Watcher.apply(self,[logger,config,true]);
    self.config = _.defaults(config || {},{
        idleReport:         60 / 5,
        maxRetries:         24 * 7,
        maxTicks:           60 * 60 / 5,
        timeoutInterval:    5
    });
    self.routes = {};
    self.queues = {};
    self.listener = new UdpListener('router',null,function(buffer) { logger.info('unexpected response: ' + JSON.stringify(buffer)); });
    self.on('queueResult',function(result){
        self.emit('note',result);
        _.defer(function (){ self.emit('checkQueue'); });
    });
    self.on('checkQueue',function(){
        self.checkQueue();
    });
}

util.inherits(QueueRouter,Watcher);

QueueRouter.ACK_PENDING_QUEUE_KEYS = ACK_PENDING_QUEUE_KEYS;
QueueRouter.COMMON_QUEUE_KEYS = COMMON_QUEUE_KEYS;

QueueRouter.prototype._onStart = function(gateway) {
    var self = this;
    self.client = require('../lib/hinted-redis').createClient().on('error',function(error){
        logger.error('redis client error: ' + error);

        // istanbul ignore else - this shouldn't occur, but just nervous about assuming it won't
        if (self.client) self.client._redisClient.end();
        self.client = null;
    });
    self.gateway = gateway;
    self.idleCount = 0;
    _.defer(function(){ self.emit('checkQueue'); });
};

QueueRouter.prototype._onStop = function(){
    if (this.client) this.client.quit();
    this.client = null;
};

QueueRouter.prototype.addRoute = function(routeIndex,router){
    logger.info('add route(' + router.queueKey + '): ' + routeIndex);
    this.queues[+routeIndex] = router.queueKey;
    this.routes[router.queueKey] = router;
    return this;
};

QueueRouter.prototype.setQueueArgs = function(){
    var routeKeys = _.map(_.select(this.routes,function(router){ return !router.busy(); }),function(router){ return router.queueKey; });
    this.ackArgs = ACK_PENDING_QUEUE_KEYS.concat(routeKeys).concat([this.config.timeoutInterval]);
    this.transmitArgs = COMMON_QUEUE_KEYS.concat(routeKeys).concat([this.config.timeoutInterval]);
};

QueueRouter.prototype.checkQueue = function(){
    if (!this.started()) return;

    var self = this;
    self.client.send('mget',ACK_STATE_KEYS).thenHint('getAckState',function(values){
        var ackState = getAckState(values);
        self.setQueueArgs();
        var queueArgs = ackState.message ? self.ackArgs : self.transmitArgs;
        self.client.send('brpop',queueArgs).thenHint('checkQueue',function(result){
            if (result)
                self.processQueueEntry(result[0],result[1],ackState);
            else if (ackState.message)
                self.processPendingMessage(ackState);
            else {
                (++self.idleCount % self.config.idleReport == 0) && logger.info('idle: ' + self.idleCount);
                self.noteQueueResult('idle');
            }
        });
    });
};

QueueRouter.prototype.processPendingMessage = function(ackState){
    var self = this;
    var retries = +ackState.retries;
    var ticks = +ackState.ticks;
    if (retries >= self.config.maxRetries) {
        logger.error('too many retries: ' + ackState.sequenceNumber);
        self.client.send('del',ACK_STATE_KEYS).thenHint('tooManyRetries',function(){
            var route = self.routes[ackState.routeKey];
            route && route.noteError(+ackState.sequenceNumber);
            self.noteQueueResult('error');
        });
    } else if (ticks < Math.min(Math.pow(2,retries) - 1,self.config.maxTicks)) {
        if (ticks !== 0 && (ticks % self.config.idleReport) === 0) logger.info('backoff: ' + ticks);
        self.client.incr(schema.ack.ticks.key).errorHint('incrTicks');
        self.noteQueueResult('tick');
    } else {
        logger.info('retry: ' + ackState.sequenceNumber);
        self.client.set(schema.ack.ticks.key,0);
        self.client.incr(schema.ack.retries.key).thenHint('incrRetries',function(){
            self.transmitMessage(new m2m.Message({json: ackState.message}),retries % 2 == 1);
            self.noteQueueResult('retry');
        });
    }
};

QueueRouter.prototype.processQueueEntry = function(queueKey,rawEntry,ackState){
    if (queueKey === schema.ack.queue.key)
        this.processAck(rawEntry,ackState);
    else if (queueKey === schema.command.queue.key)
        this.processCommand(rawEntry,ackState);
    else if (queueKey === schema.transmit.queue.key)
        this.processTransmit(rawEntry,ackState);
    else
        this.processRoute(queueKey,rawEntry,ackState);
};

QueueRouter.prototype.processAck = function(rawEntry,ackState){
    var self = this;
    var queueEntry = this.safeParseJSON(rawEntry);
    if (ackState.message && +queueEntry === +ackState.sequenceNumber) {
        logger.info('acked: ' + ackState.sequenceNumber);
        self.client.send('del', ACK_STATE_KEYS).thenHint('clearAckState', function () {
            var route = self.routes[ackState.routeKey];
            route && route.noteAck(+ackState.sequenceNumber);
            self.noteQueueResult('ack');
        });
    } else {
        logger.warn('ignoring ack: ' + rawEntry);
        self.noteQueueResult('ignoreAck');
    }
};

QueueRouter.prototype.processCommand = function(rawEntry,ackState) {
    var self = this;
    var message = new m2m.Message({json: rawEntry});
    switch (message.eventCode){
        case settings.EventCodes.deviceCommand:
            var command = message.find(settings.ObjectTypes.deviceCommand,null);
            var routeIndex = message.find(settings.ObjectTypes.deviceIndex,1);
            var queueKey = self.queues[routeIndex];
            var route = self.routes[queueKey];
            if (!route) {
                logger.warn('route not found: ' + rawEntry);
                self.noteQueueResult('routeNoteFound');
            } else if (!command) {
                logger.warn('command not found: ' + rawEntry);
                self.noteQueueResult('commandNotFound');
            } else {
                self.client.lpush(queueKey,JSON.stringify({command: command,requestID: message.sequenceNumber}));
                self.noteQueueResult('command');
            }
            break;
        default:
            logger.warn('ignoring command: ' + rawEntry);
            self.noteQueueResult('ignoreCommand');
    }
};

QueueRouter.prototype.processTransmit = function(rawEntry,ackState) {
    var queueEntry = this.safeParseJSON(rawEntry);
    if (queueEntry) {
        logger.error('valid message received: ' + rawEntry);
        this.generateMessage(queueEntry);
    } else {
        logger.error('invalid message received: ' + rawEntry);
        this.noteQueueResult('error');
    }
};

QueueRouter.prototype.processRoute = function(queueKey,rawEntry,ackState) {
    var queueEntry = this.safeParseJSON(rawEntry);
    logger.info('route(' + queueKey + '): ' + rawEntry);
    var route = this.routes[queueKey];
    route && route.processQueueEntry(queueEntry);
    this.noteQueueResult('route');
};

QueueRouter.prototype.generateMessage = function(attributes) {
    var routeKey = attributes.routeKey;
    delete attributes.routeKey;

    var eventCode = attributes.eventCode || settings.EventCodes.heartbeat;
    delete attributes.eventCode;

    var timestamp = attributes.timestamp;
    delete attributes.timestamp;

    var sequenceNumber = +attributes.sequenceNumber;
    delete attributes.sequenceNumber;

    var self = this;
    if (sequenceNumber)
        self.assembleMessage(routeKey,eventCode,timestamp,sequenceNumber,attributes);
    else
        self.client.incr(schema.transmit.lastSequenceNumber.key).thenHint('incrSequenceNumber',function(newSequenceNumber){
            self.assembleMessage(routeKey,eventCode,timestamp,newSequenceNumber,attributes);
        });
};

QueueRouter.prototype.assembleMessage = function(routeKey,eventCode,timestamp,sequenceNumber,attributes){
    var self = this;
    var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,eventCode: eventCode,sequenceNumber: +sequenceNumber,timestamp: timestamp})
        .pushString(0,self.gateway.imei);
    _.each(attributes,function(value,key){
        var code = +key;
        if (code > 0 && value !== null)
            switch(typeof value){
                case 'number':
                    message.pushInt(code,value);
                    break;
                case 'string':
                    var json = JSON.stringify(value);
                    if (json.length > value.length + 2) // NOTE add 2 for bounding quote characters...
                        message.pushUByteArray(code,new Buffer(value));
                    else
                        message.pushString(code,value);
                    break;
                // istanbul ignore next - options will expand over time; no need to test for specific failures...
                default:
                    logger.error('unexpected key/value: ' + key + '=' + value);

            }
    });

    self.client.send('mset',ackStatePairs(message,routeKey)).thenHint('setAckState',function(){
        self.transmitMessage(message);
        self.noteQueueResult('transmit');
    });
};

QueueRouter.prototype.transmitMessage = function(message,toggleRelay){
    var relay = !toggleRelay ? this.gateway.primary : this.gateway.primary === 'public' ? 'private' : 'public';
    logger.info('transmit: ' + JSON.stringify(message));
    this.idleCount = 0;
    this.listener.send(message.toWire(),'localhost',+this.gateway[relay + 'Relay']);
};

QueueRouter.prototype.noteQueueResult = function(result){
    this.emit('queueResult',result);
};

QueueRouter.prototype.safeParseJSON = function(contents) {
    try {
        return JSON.parse(contents);
    } catch(e) {
        logger.error('json error: ' + e);
        this.emit('note','error');
        return null;
    }
};

module.exports = QueueRouter;

