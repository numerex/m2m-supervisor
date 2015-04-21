
module.exports.deviceKey = 'testDevice';
module.exports.queueKey = 'testQueue';

module.exports.events = [];

module.exports.noteAck = function(sequenceNumber){
    module.exports.events.push(sequenceNumber);
};

module.exports.processQueueEntry = function(command){
    module.exports.events.push(command);
};

module.exports.snapshot = function(){
    var result = module.exports.events;
    module.exports.events = [];
    return result;
};