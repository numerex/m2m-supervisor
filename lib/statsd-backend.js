module.exports.init = function(startupTime, config, events) {
    var redis = require('redis');

    events.on('flush',function(timestamp, metrics){
        console.log('FLUSH! ' + timestamp + ' (' + (timestamp - startupTime) + ')');
        console.dir(metrics);
    });

    events.on('status',function(callback){
        console.log('STATUS!');
        callback(null,'m2m','test',0);
    });

    //events.on('packet',function(packet, rinfo){});

    return true;
};
