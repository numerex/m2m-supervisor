var _ = require('lodash');

var GatewayProxy = require('../services/gateway-proxy');
var RedisWatcher = require('../services/redis-watcher');
var HashWatcher = require('../services/hash-watcher');
var QueueRouter = require('../services/queue-router');
var DeviceRouter = require('../services/device-router');
var RouteWatcher = require('../services/route-watcher');
var ModemWatcher = require('../services/modem-watcher');
var HeartbeatGenerator = require('../services/heartbeat-generator');
var HttpServer = require('../services/http-server');

var SocketServer = require('../sockets/socket-server');
var ShellBehavior = require('../sockets/shell-behavior');

var schema = require('../lib/redis-schema');
var configHashkeys = require('../lib/config-hashkeys');

function M2mSupervisor(httpPort,config){
    var self = this;
    self.queueRouter = new QueueRouter(config);

    self.modemWatcher = new ModemWatcher(config)
        .on('imei',function(imei){ RedisWatcher.instance.client.hsetnx(schema.config.key,configHashkeys.gateway.imei.key,imei).errorHint('setIMEI'); });

    self.routeWatcher = new RouteWatcher(config);

    self.proxy = new GatewayProxy(config);
    self.heartbeat = new HeartbeatGenerator(self.proxy,config);
    self.configWatcher = new HashWatcher(schema.config.key,configHashkeys,config)
        .addKeysetWatcher('PPP',true,self.routeWatcher)
        .addKeysetWatcher('modem',true,self.modemWatcher)
        .addKeysetWatcher('gateway',false,self.proxy)
        .addKeysetWatcher('gateway',true,self.heartbeat)
        .addKeysetWatcher('gateway',true,self.queueRouter);

    self.redisWatcher = new RedisWatcher(config)
        .on('ready',_.bind(self.configureDevices,self))
        .addClientWatcher(self.configWatcher);

    self.httpServer = new HttpServer().start(httpPort || process.env.PORT || '3000');
    self.socketServer = new SocketServer().start(self.httpServer);
    self.shellBehavior = new ShellBehavior().registerSelf(self.socketServer);
}

M2mSupervisor.prototype.start = function(){
    this.redisWatcher.start();
    return this;
};

M2mSupervisor.prototype.stop = function(){
    this.redisWatcher.stop();
};

M2mSupervisor.prototype.configureDevices = function(client){
    if (!client) return;

    var self = this;
    _.each(self.redisWatcher.keys,function(key){
        var deviceKey = schema.device.settings.getParam(key);
        // istanbul ignore if - should never occur, but nervous about not checking...
        if (!deviceKey) return;
        // istanbul ignore if - TODO maybe recreate or refresh it??
        if (self.queueRouter.routes[deviceKey]) return;

        var deviceRouter = new DeviceRouter(deviceKey)
            .on('status',function(status){ if (status == 'ready') self.queueRouter.addRoute(deviceRouter); });
        self.redisWatcher.addClientWatcher(deviceRouter.settingsWatcher);
        deviceRouter.start(client);
        deviceRouter.settingsWatcher.start(client);
    });
};

module.exports = M2mSupervisor;