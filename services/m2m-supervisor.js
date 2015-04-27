var _ = require('lodash');

var GatewayProxy = require('./gateway-proxy');
var RedisWatcher = require('./redis-watcher');
var HashWatcher = require('./hash-watcher');
var QueueRouter = require('./queue-router');
var DeviceRouter = require('./device-router');
var RouteWatcher = require('./route-watcher');
var ModemWatcher = require('./modem-watcher');
var HeartbeatGenerator = require('./heartbeat-generator');
var HttpServer = require('./http-server');

var SocketServer = require('../sockets/socket-server');
var ShellBehavior = require('../sockets/shell-behavior');

var schema = require('../lib/redis-schema');
var configHashkeys = require('../lib/config-hashkeys');

function M2mSupervisor(httpPort){
    var self = this;
    self.queueRouter = new QueueRouter();

    self.modemWatcher = new ModemWatcher()
        .on('imei',function(imei){ RedisWatcher.instance.client.hsetnx(schema.config.key,configHashkeys.gateway.imei.key,imei); });

    self.routeWatcher = new RouteWatcher();

    self.proxy = new GatewayProxy();
    self.heartbeat = new HeartbeatGenerator(self.proxy);
    self.configWatcher = new HashWatcher(schema.config.key,configHashkeys)
        .addKeysetWatcher('PPP',true,self.routeWatcher)
        .addKeysetWatcher('modem',true,self.modemWatcher)
        .addKeysetWatcher('gateway',false,self.proxy)
        .addKeysetWatcher('gateway',true,self.heartbeat)
        .addKeysetWatcher('gateway',true,self.queueRouter);

    self.redisWatcher = new RedisWatcher()
        .on('ready',_.bind(self.configureDevices,self))
        .addClientWatcher(self.configWatcher);

    self.httpServer = new HttpServer().start(httpPort || process.env.PORT || '3000');
    self.socketServer = new SocketServer().start(self.httpServer);
    self.shellBehavior = new ShellBehavior().registerSelf(self.socketServer);
}

M2mSupervisor.prototype.start = function(){
    this.redisWatcher.start();
};

M2mSupervisor.prototype.stop = function(){
    this.redisWatcher.stop();
};

M2mSupervisor.prototype.configureDevices = function(redis){
    if (!redis) return;

    var self = this;
    _.each(self.redisWatcher.keys,function(key){
        var deviceKey = schema.device.settings.getParam(key);
        if (!deviceKey) return;
        if (self.queueRouter.routes[deviceKey]) return; // TODO maybe recreate or refresh it??

        var deviceRouter = new DeviceRouter(deviceKey)
            .on('status',function(status){ if (status == 'ready') self.queueRouter.addRoute(deviceRouter); });
        self.redisWatcher.addClientWatcher(deviceRouter.settingsWatcher);
        deviceRouter.start(redis);
        deviceRouter.settingsWatcher.start(redis);
    });
};

module.exports = M2mSupervisor;