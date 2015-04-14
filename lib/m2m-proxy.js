var m2m = require('m2m-ota-javascript');

var UdpListener = require('./udp-listener');

var schema = require('./redis-schema');
var logger = require('./logger')('proxy');

function M2mProxy(redis,gateway,note) {

    var proxy = this;
    proxy.noteEvent = note || function(){};
    proxy.gateway = gateway;

    proxy.sendPrivate = function(buffer){
        var timestamp = new Date().valueOf();
        redis.mset(schema.transmit.lastTimestamp.key,timestamp,schema.transmit.lastPrivateTimestamp.key,timestamp); // TODO capture possible errors
        proxy.outside.send(buffer,gateway.privateHost,+gateway.privatePort);
        proxy.noteEvent('private');
    };

    proxy.sendPublic = function(buffer){
        redis.set(schema.transmit.lastTimestamp.key,new Date().valueOf()); // TODO capture possible errors
        proxy.outside.send(buffer,gateway.publicHost,+gateway.publicPort);
        proxy.noteEvent('public');
    };

    proxy.sendPrimary = function(buffer){
        if (proxy.gateway.primary == 'private')
            proxy.sendPrivate(buffer);
        else
            proxy.sendPublic(buffer);
    };

    proxy.private = new UdpListener('private',+gateway.privateRelay,proxy.sendPrivate);
    proxy.public = new UdpListener('public',+gateway.publicRelay,proxy.sendPublic);
    proxy.outside = new UdpListener('outside',null,function(buffer) {
        try {
            var message = new m2m.Message({buffer: buffer});
            switch (message.messageType) {
                case m2m.Common.MOBILE_TERMINATED_EVENT:
                    // TODO send ack now?
                    logger.info('enqueue command');
                    redis.lpush(schema.command.queue.key,JSON.stringify(message)); // TODO capture possible errors
                    break;
                case m2m.Common.MOBILE_TERMINATED_ACK:
                    logger.info('receive ack');
                    redis.lpush(schema.ack.queue.key,message.sequenceNumber); // TODO capture possible errors
                    break;
                default:
                    logger.error('unexpected message type: ' + message.messageType);
            }
        } catch(e) {
            logger.error('enqueue error: ' + e);
        }
    });

    proxy.noteEvent('ready');
}

module.exports = M2mProxy;
