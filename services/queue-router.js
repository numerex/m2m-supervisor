var _ = require('lodash');
var m2m = require('m2m-ota-javascript');
var util = require('util');
var events = require('events');

var UdpListener = require('../lib/udp-listener');

var logger = require('../lib/logger')('router');
var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

var COMMON_QUEUE_KEYS = Object.freeze([
    schema.ack.queue.key,
    schema.transmit.queue.key
]);

var ACK_STATE_KEYS = Object.freeze([
    schema.ack.message.key,
    schema.ack.routeKey.key,
    schema.ack.retries.key,
    schema.ack.sequenceNumber.key
]);

QueueRouter.ACK_STATE_KEYS = ACK_STATE_KEYS;

function getAckState(values){
    return {
        message:        values[0],
        routeKey:       values[1],
        retries:        values[2] || '0',
        sequenceNumber: values[3] || '0'
    }
}

function ackStatePairs(message,routeKey) {
    return [
        ACK_STATE_KEYS[0],JSON.stringify(message),
        ACK_STATE_KEYS[1],routeKey || 'none',
        ACK_STATE_KEYS[2],0,
        ACK_STATE_KEYS[3],message.sequenceNumber
    ];
}

function QueueRouter(redis,gateway,config) {
    var self = this;
    self.config = _.defaults(config || {},{
        idleReport:         60 / 5,
        maxRetries:         5,
        timeoutInterval:    5
    });
    self.redis = redis;
    self.routes = {};
    self.setQueueArgs();
    self.gateway = gateway;
    self.client = new UdpListener('router',null,function(buffer) { logger.info('unexpected response: ' + JSON.stringify(buffer)); });
    self.on('queueResult',function(result){
        self.emit('note',result);
        _.defer(function (){ self.emit('checkQueue'); });
    });
    self.on('checkQueue',function(){
        self.checkQueue();
    });
}

util.inherits(QueueRouter,events.EventEmitter);

QueueRouter.COMMON_QUEUE_KEYS = COMMON_QUEUE_KEYS;

QueueRouter.prototype.started = function(){
    return !!this.startCalled;
};

QueueRouter.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start router');

    var self = this;
    self.startCalled = true;
    self.idleCount = 0;
    _.defer(function(){ self.emit('checkQueue'); });
    return self;
};

QueueRouter.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop router');

    this.startCalled = false;
};

QueueRouter.prototype.addRoute = function(router){
    logger.info('add route: ' + router.queueKey);
    this.routes[router.queueKey] = router;
    this.setQueueArgs();
    return this;
};

QueueRouter.prototype.setQueueArgs = function(){
    var routeKeys = _.keys(this.routes);
    this.ackArgs = [schema.ack.queue.key].concat(routeKeys).concat([this.config.timeoutInterval]);
    this.transmitArgs = COMMON_QUEUE_KEYS.concat(routeKeys).concat([this.config.timeoutInterval]);
};

QueueRouter.prototype.checkQueue = function(){
    if (!this.started()) return;

    var self = this;
    self.redis.send('mget',ACK_STATE_KEYS).then(function(values){
        var ackState = getAckState(values);
        var queueArgs = ackState.message ? self.ackArgs : self.transmitArgs;
        self.redis.send('brpop',queueArgs).then(function(result){
            if (result) {
                var queueKey = result[0];
                var value = self.safeParseJSON(result[1]);
                if (queueKey === schema.ack.queue.key) {
                    if (ackState.message && +value === +ackState.sequenceNumber) {
                        logger.info('acked: ' + ackState.sequenceNumber);
                        self.redis.send('del',ACK_STATE_KEYS).then(function(){
                            var route = self.routes[ackState.routeKey];
                            route && route.noteAck(+ackState.sequenceNumber);
                            self.noteQueueResult('ack');
                        });
                    } else {
                        logger.warn('ignoring queue entry: ' + value);
                        self.noteQueueResult('ignore');
                    }
                } else if (queueKey === schema.transmit.queue.key) {
                    if (value) {
                        logger.error('valid message received: ' + result[1]);
                        self.generateMessage(value);
                    } else {
                        logger.error('invalid message received: ' + result[1]);
                        self.noteQueueResult('error');
                    }
                } else {
                    logger.info('route(' + queueKey + '): ' + result[1]);
                    var route = self.routes[queueKey];
                    route && route.processQueueEntry(value);
                    self.noteQueueResult('command');
                }
            } else if (ackState.message){
                if (+ackState.retries >= self.config.maxRetries) {
                    logger.error('too many retries: ' + ackState.sequenceNumber);
                    self.redis.send('del',ACK_STATE_KEYS).then(function(){
                        var route = self.routes[ackState.routeKey];
                        route && route.noteError(+ackState.sequenceNumber);
                        self.noteQueueResult('error');
                    });
                } else {
                    logger.info('retry: ' + ackState.sequenceNumber);
                    self.redis.incr(schema.ack.retries.key).then(function(){
                        self.transmitMessage(new m2m.Message({json: ackState.message}));
                        self.noteQueueResult('retry');
                    });
                }
            } else {
                (++self.idleCount % self.config.idleReport == 0) && logger.info('idle: ' + self.idleCount);
                self.noteQueueResult('idle');
            }
        });
    });
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
        self.redis.incr(schema.transmit.lastSequenceNumber.key).then(function(newSequenceNumber){
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
                    message.pushString(code,value);
                    break;
                // istanbul ignore next - TODO improve self...
                default:
                    logger.error('unexpected key/value: ' + key + '=' + value);

            }
    });

    self.redis.send('mset',ackStatePairs(message,routeKey)).then(function(){
        self.transmitMessage(message);
        self.noteQueueResult('transmit');
    });
};

QueueRouter.prototype.transmitMessage = function(message){
    logger.info('transmit: ' + JSON.stringify(message));
    this.idleCount = 0;
    this.client.send(message.toWire(),'localhost',+this.gateway[this.gateway.primary + 'Relay']); // TODO which relay to use?
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

