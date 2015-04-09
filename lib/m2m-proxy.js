var m2m = require('m2m-ota-javascript');

var UdpListener = require('./udp-listener');
var ConfigCheckpoint = require('./config-checkpoint');

var defaults = require('../config/m2m-defaults');
var schema = require('./redis-schema');
var logger = require('./logger')('proxy');

function M2mProxy(redis,done) {

    var proxy = this;
    proxy.checkpoint = new ConfigCheckpoint(redis,schema.config.gateway.key,defaults,['imei']).start(function(event,gateway){
        if (event !== 'ready') return;

        proxy.gateway = gateway;
        proxy.outside = new UdpListener('outside',null,enqueueMessage);
        proxy.private = new UdpListener('private',+gateway.privateRelay,function(buffer) {
            var timestamp = new Date().valueOf();
            redis.mset(schema.transmit.lastTimestamp.key,timestamp,schema.transmit.lastPrivateTimestamp.key,timestamp); // TODO capture possible errors
            proxy.outside.send(buffer,gateway.privateHost,+gateway.privatePort);
        });
        proxy.public = new UdpListener('public',+gateway.publicRelay,function(buffer){
            redis.set(schema.transmit.lastTimestamp.key,new Date().valueOf()); // TODO capture possible errors
            proxy.outside.send(buffer,gateway.publicHost,+gateway.publicPort);
        });

        function enqueueMessage(buffer) {
            try {
                var message = new m2m.Message({buffer: buffer});
                switch (message.messageType) {
                    case m2m.Common.MOBILE_TERMINATED_EVENT:
                        // TODO send ack now?
                        logger.info('command');
                        redis.lpush(schema.command.queue.key,JSON.stringify(message)); // TODO capture possible errors
                        break;
                    case m2m.Common.MOBILE_TERMINATED_ACK:
                        logger.info('ack');
                        redis.lpush(schema.ack.queue.key,message.sequenceNumber); // TODO capture possible errors
                        break;
                    default:
                        logger.error('unexpected message type: ' + message.messageType);
                }
            } catch(e) {
                logger.error('enqueue error: ' + e);
            }
        }

        if (done) done();
    });

}

module.exports = M2mProxy;
