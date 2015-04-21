var logger = require(process.cwd() + '/lib/logger')('test-route');

module.exports.deviceKey = 'testDevice';
module.exports.queueKey = 'testQueue';

module.exports.events = [];

module.exports.noteAck = function(sequenceNumber){
    logger.info('ack: ' + sequenceNumber);
    module.exports.events.push({ack: sequenceNumber});
};

module.exports.noteError = function(sequenceNumber){
    logger.info('error: ' + sequenceNumber);
    module.exports.events.push({error: sequenceNumber});
};

module.exports.processQueueEntry = function(command){
    logger.info('command: ' + command);
    module.exports.events.push({command: command});
};

module.exports.snapshot = function(){
    var result = module.exports.events;
    module.exports.events = [];
    return result;
};