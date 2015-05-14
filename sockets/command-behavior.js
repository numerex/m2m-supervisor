var RedisWatcher = require('../services/redis-watcher');

var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');

var logger = require('../lib/logger')('command');

function CommandBehavior(){
    var self = this;
    self.client = null;
    self.eventHandlers = [
        {event: 'input',callback: function(socket,data){ self.commandEvent(socket,data); }}
    ];
}

CommandBehavior.prototype.registerSelf = function(socketServer){
    socketServer.registerBehavior('command',this);
    return this;
};

CommandBehavior.prototype.closeEvent = function(socket) {
    logger.info('close(' + socket.clientID + ')');
    this.cleanup();
};

CommandBehavior.prototype.disconnectEvent = function(socket) {
    logger.info('disconnect(' + socket.clientID + ')');
    this.cleanup();
};

CommandBehavior.prototype.commandEvent = function(socket,input){
    var self = this;
    try {
        logger.info('input(' + socket.clientID + '): ' + JSON.stringify(input));

        if (!RedisWatcher.instance || !RedisWatcher.instance.started()) throw(new Error('Redis not started'));

        var queueKey = schema.device.queue.useParam(input.device);
        self.client = require('../lib/hinted-redis').createClient()
            .on('error',function(error){
                logger.error('redis client error: ' + error);

                // istanbul ignore else - this shouldn't occur, but just nervous about assuming it won't
                if (self.client) self.client._redisClient.end();
                self.client = null;
            });
        socket.emit('started',{id: socket.clientID,command: input.command});
        self.client.del(schema.web.queue.key);
        self.client.lpush(queueKey,JSON.stringify({command: input.command,responseID: socket.clientID,destination: schema.web.queue.key})).errorHint('deviceQueue:' + socket.clientID);
        self.client.brpop(schema.web.queue.key,10).thenHint('webQueue:' + socket.clientID,function(result){
            if (!result)
                socket.emit('output',{id: socket.clientID,command: input.command,stderr: 'timeout'});
            else {
                var entry = JSON.parse(result[1]);
                socket.emit('output',{
                    id:         socket.clientID,
                    command:    input.command,
                    stdout:     entry[settings.ObjectTypes.deviceResponse.toString()] || null,
                    stderr:     entry[settings.ObjectTypes.deviceError.toString()] || null
                });
            }
            self.cleanup();
        })

    } catch(e) {
        logger.error('command error: ' + e);
        socket.emit('output',{id: socket.clientID,stderr: e.message});
    }
};

CommandBehavior.prototype.cleanup = function(){
    if (this.client) this.client.quit();
    this.client = null;
};

module.exports = CommandBehavior;