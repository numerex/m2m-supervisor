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
        routeKey:       values[1] || 'none',
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
    self.queueArgs = COMMON_QUEUE_KEYS.concat([self.config.timeoutInterval]);
    self.gateway = gateway;
    self.client = new UdpListener('router',null,function(buffer) { logger.info('unexpected response: ' + JSON.stringify(buffer)); });
}

util.inherits(QueueRouter,events.EventEmitter);

QueueRouter.COMMON_QUEUE_KEYS = COMMON_QUEUE_KEYS;

QueueRouter.prototype.started = function(){
    return !!this.startCalled;
};

QueueRouter.prototype.ready = function(){
    return this.started() && !!this.gateway;
};

QueueRouter.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start router');

    var self = this;
    self.startCalled = true;
    self.idleCount = 0;
    self.checkDepth = 0;
    self.checkQueueCallback = function(){
console.log('async called:' + self.ready());
        self.checkQueue();
    };
    self.asyncCheckQueue();
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
    this.queueArgs = COMMON_QUEUE_KEYS.concat(_.keys(this.routes)).concat([this.config.timeoutInterval]);
    return this;
};

QueueRouter.prototype.nestedCall = function(callback){

};

QueueRouter.prototype.checkQueue = function(){
    this.timeout && clearTimeout(this.timeout);
    this.timeout = null;

    var self = this;
    self.redis.mget(ACK_STATE_KEYS,_.bind(self.redisCheckResult,self,'checkQueue-mget',_,_,function(values){
console.log('mget:' + values);
        var ackState = getAckState(values);
        if (ackState.message)
            self.redis.brpop([schema.ack.queue.key,self.config.timeoutInterval],_.bind(self.redisCheckResult,self,'checkQueue-brpop1',_,_,function(result){
console.log('brpop1:' + result);
                if (result && result[0] == schema.ack.queue.key && +result[1] === +ackState.sequenceNumber) {
                    logger.info('acked: ' + ackState.sequenceNumber);
                    self.redis.del(ACK_STATE_KEYS,_.bind(self.redisCheckResult,self,'checkQueue-del1',_,_,function(){
                        var route = self.routes[ackState.routeKey];
                        route && route.noteAck(+ackState.sequenceNumber);
                        self.emit('note','ack');
                    }));
                } else if (+ackState.retries >= self.config.maxRetries) {
                    logger.error('too many retries: ' + ackState.message);
                    self.redis.del(ACK_STATE_KEYS,_.bind(self.redisCheckResult,self,'checkQueue-del2',_,_,function(){
                        self.emit('note','error');
                    }));
                } else {
                    logger.info('retry: ' + ackState.sequenceNumber);
                    self.redis.incr(schema.ack.retries.key,_.bind(self.redisCheckResult,self,'checkQueue-incr',_,_,function(){
                        self.transmitMessage(new m2m.Message({json: ackState.message}));
                        self.emit('note','retry');
                    }));
                }
            }));
        else
            self.redis.brpop(self.queueArgs,_.bind(self.redisCheckResult,self,'checkQueue-brpop2',_,_,function(result){
console.log('brpop2:' + result);
                if (!result) {
                    (++self.idleCount % self.config.idleReport == 0) && logger.info('idle: ' + self.idleCount);
                    self.emit('note','idle');
                } else if (result[0] === schema.ack.queue.key) {
                    logger.warn('ignoring queue entry: ' + result[1]);
                    self.emit('note','ignore');
                } else if (result[0] === schema.transmit.queue.key) {
                    var attributes = self.safeParseJSON(result[1]);
                    if (attributes)
                        self.generateMessage(attributes);
                    else {
                        logger.error('invalid message received: ' + result[1]);
                        self.emit('note','error');
                    }
                } else {
                    logger.info('route(' + result[0] + '): ' + result[1]);
                    var route = self.routes[result[0]];
                    route && route.processQueueEntry(result[1]);
                    self.emit('note','command');
                }
            }));
    }));
};

QueueRouter.prototype.generateMessage = function(attributes) {
    var eventCode = attributes.eventCode || settings.EventCodes.heartbeat;
    delete attributes.eventCode;

    var timestamp = attributes.timestamp;
    delete attributes.timestamp;

    var sequenceNumber = +attributes.sequenceNumber;
    delete attributes.sequenceNumber;
    
    var self = this;
    if (sequenceNumber)
        self.assembleMessage(eventCode,timestamp,sequenceNumber,attributes);
    else
        self.redis.incr(schema.transmit.lastSequenceNumber.key,_.bind(self.redisCheckResult,self,'generateMessage',_,_,function(newSequenceNumber){
            self.assembleMessage(eventCode,timestamp,newSequenceNumber,attributes);
        }));
};

QueueRouter.prototype.assembleMessage = function(eventCode,timestamp,sequenceNumber,attributes){
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

    self.redis.mset(ackStatePairs(message,null),_.bind(self.redisCheckResult,self,'assembleMessage',_,_,function(){
        self.transmitMessage(message);
        self.emit('note','transmit')
    }));
};

QueueRouter.prototype.transmitMessage = function(message){
    logger.info('transmit: ' + JSON.stringify(message));
    this.idleCount = 0;
    this.client.send(message.toWire(),'localhost',+this.gateway[this.gateway.primary + 'Relay']); // TODO which relay to use?
};

QueueRouter.prototype.asyncCheckQueue = function(){
console.log('async submit:' + this.ready());
    if (this.ready()) this.timeout = setTimeout(this.checkQueueCallback,1);
};

QueueRouter.prototype.redisCheckResult = function(caller,err,value,callback) {
    if (!err) {
        try {
console.log(caller + ' before:' + this.checkDepth);            
            this.checkDepth++;
            callback(value);
        } catch(e) {
            logger.error('check callback failure(' + caller + '): ' + e);
            // istanbul ignore else - NOTE re-throw what is likely an assert failuring during testing
            if (process.env.testing) throw(e);
            this.emit('note','error');
        }
        this.checkDepth--;
console.log(caller + ' after:' + this.checkDepth);
    } else {
console.log(caller + ' error:' + this.checkDepth);
        logger.error('redis check error(' + caller + '): ' + err);
        this.emit('note','error');
        this.asyncCheckQueue();
    }
    if (this.checkDepth < 0) {
        logger.error('check depth underflow(' + caller + '): ' + this.checkDepth);
        this.emit('note','error');
    } else if (this.checkDepth == 0 && this.ready()) {
        this.asyncCheckQueue();
    }
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

