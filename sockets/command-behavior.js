var M2mSupervisor = null;
var RedisWatcher = require('../services/redis-watcher');

var schema = require('../lib/redis-schema');
var settings = require('../lib/m2m-settings');
var hashkeys = require('../lib/peripheral-hashkeys');

var logger = require('../lib/logger')('command');

const TIMEOUT_INTERVAL = 10;

function CommandBehavior(){
    var self = this;
    self.eventHandlers = [
        {event: 'peripheral',callback: function(socket,data){ self.peripheralEvent(socket,data); }},
        {event: 'command',callback: function(socket,data){ self.commandEvent(socket,data); }}
    ];
    self.emissions = [
        'started',
        'output',
        'note'
    ];
    M2mSupervisor = require('../processes/m2m-supervisor'); // delay for instance to exist
}

CommandBehavior.prototype.registerSelf = function(socketServer){
    socketServer.registerBehavior('command',this);
    return this;
};

CommandBehavior.prototype.closeEvent = function(socket) {
    logger.info('close(' + socket.clientID + ')');
    this.cleanupPeripheralContext(socket);
};

CommandBehavior.prototype.disconnectEvent = function(socket) {
    logger.info('disconnect(' + socket.clientID + ')');
    this.cleanupPeripheralContext(socket);
};

CommandBehavior.prototype.peripheralEvent = function(socket,peripheral){
    var peripheralRouter = null;
    var commandQueueKey = schema.peripheral.queue.useParam(peripheral);
    if (!RedisWatcher.instance || !RedisWatcher.instance.started())
        socket.emit('output',{id: socket.clientID,stderr: 'Redis not ready'});
    else if (!M2mSupervisor.instance ||
        !M2mSupervisor.instance.queueRouter ||
        !M2mSupervisor.instance.queueRouter.started() ||
        !(peripheralRouter = M2mSupervisor.instance.queueRouter.routes[commandQueueKey]) ||
        !peripheralRouter.reader)
        socket.emit('output',{id: socket.clientID,stderr: 'Peripheral not ready: ' + peripheral});
    else {
        logger.info('peripheral(' + socket.clientID + '): ' + JSON.stringify(peripheral));
        socket.webQueueKey = schema.web.queue.useParam(socket.clientID);
        if (!socket.redisClient)
            // istanbul ignore next - TODO find a way to DRY this up w/ others like it...
            socket.redisClient = require('../lib/hinted-redis').createClient().on('error',function(error){
                logger.error('redis client error(' + socket.clientID + '): ' + error);
                if (socket.redisClient) socket.redisClient._redisClient.end();
                socket.redisClient = null;
            });
        socket.commandQueueKey = commandQueueKey;
        socket.redisClient.del(socket.webQueueKey);
        socket.emit('output',{id: socket.clientID,stdin: 'Peripheral ready: ' + peripheral});

        socket.redisClient.hgetall(schema.peripheral.settings.useParam(peripheral)).thenHint('getSettings',function(settings){
            socket.emit('note',{id: socket.clientID,profile: (settings && settings[hashkeys.commands.profile.key]) || null});
        });
    }
};

CommandBehavior.prototype.commandEvent = function(socket,input){
    if (!socket.commandQueueKey)
        socket.emit('output',{id: socket.clientID,stderr: 'Peripheral not ready'});
    else {
        logger.info('command(' + socket.clientID + '): ' + JSON.stringify(input));

        socket.emit('started',{id: socket.clientID,command: input.command});
        socket.redisClient.lpush(socket.commandQueueKey,JSON.stringify({command: input.command,responseID: socket.clientID,destination: socket.webQueueKey})).errorHint('peripheralQueue:' + socket.clientID);
        socket.redisClient.brpop(socket.webQueueKey,TIMEOUT_INTERVAL).thenHint('webQueue:' + socket.clientID,function(result){
            if (!result)
                socket.emit('output',{id: socket.clientID,command: input.command,stderr: 'timeout'});
            else {
                var entry = JSON.parse(result[1]);
                socket.emit('output',{
                    id:         socket.clientID,
                    command:    input.command,
                    stdout:     entry[settings.ObjectTypes.peripheralResponse.toString()] || null,
                    stderr:     entry[settings.ObjectTypes.peripheralError.toString()] || null
                });
            }
        })
    }
};

CommandBehavior.prototype.cleanupPeripheralContext = function(socket){
    socket.commandQueueKey = null;
    if (socket.redisClient) {
        socket.redisClient.del(socket.webQueueKey);
        socket.redisClient.quit();
    }
    socket.redisClient = null;
};

module.exports = CommandBehavior;