var _ = require('lodash');

var DhclientWatcher = require('../services/dhclient-watcher');
var GatewayProxy = require('../services/gateway-proxy');
var RedisWatcher = require('../services/redis-watcher');
var HashWatcher = require('../services/hash-watcher');
var RouteWatcher = require('../services/route-watcher');
var QueueRouter = require('../services/queue-router');
var PppdWatcher = require('../services/pppd-watcher');
var ModemWatcher = require('../services/modem-watcher');
var HeartbeatGenerator = require('../services/heartbeat-generator');
var HttpServer = require('../services/http-server');

var SocketServer = require('../sockets/socket-server');
var ShellBehavior = require('../sockets/shell-behavior');
var CommandBehavior = require('../sockets/command-behavior');

var schema = require('../lib/redis-schema');
var configHashkeys = require('../lib/config-hashkeys');

function M2mSupervisor(config){

    // istanbul ignore if - only for distinguishing log boundaries at run-time
    if (!process.env.testing) console.log('------------------------------------------------');

    config = config || {};

    var httpPort        = config.httpPort || process.env.PORT || '5000';
    var runBridge       = config.runBridge;
    var runWeb          = config.runWeb;
    var runTransceiver  = config.runTransceiver;
    var runAll          = !runBridge && !runWeb && !runTransceiver;

    var self = this;

    self.supervisorProxy = false;
    if (config.runProxy) {
        runBridge = runTransceiver = runAll = false;
        self.supervisorProxy  = runWeb = true;
    }

    self.configWatcher  = new HashWatcher(schema.config.key,configHashkeys,config);
    self.redisWatcher   = new RedisWatcher(config);

    if (runBridge || runAll) {
        self.heartbeat  = null;
        self.gateway    = new GatewayProxy(config);
        self.modem      = new ModemWatcher(config);
        self.pppd       = new PppdWatcher(config);
        self.dhclient   = new DhclientWatcher(config);

        self.configWatcher
            .addKeysetWatcher('gateway',    false,  self.gateway)
            .addKeysetWatcher('cellular',   true,   self.pppd)
            .addKeysetWatcher('cellular',   true,   self.modem);

        self.pppd.on('ready',function(ready){
            if (ready && !self.heartbeat) {
                self.heartbeat = new HeartbeatGenerator(self.gateway,config);
                self.configWatcher.addKeysetWatcher('gateway',true,self.heartbeat);
            }
            self.modem.ensureStartStop(ready ? self.pppd.cellular : null);
            self.heartbeat && self.heartbeat.ensureStartStop(ready ? self.gateway.config : null);
        });
    }

    if (runTransceiver || runAll) {
        self.queueRouter = new QueueRouter(config);
        self.configWatcher.addKeysetWatcher('gateway',true,self.queueRouter);

        self.routeWatcher = new RouteWatcher(self.queueRouter);
        self.redisWatcher.addClientWatcher(self.routeWatcher);
    }

    self.redisWatcher.addClientWatcher(self.configWatcher);

    if (runWeb || runAll) {
        self.httpServer       = new HttpServer().start(httpPort);
        self.socketServer     = new SocketServer().start(self.httpServer);
        self.shellBehavior    = new ShellBehavior().registerSelf(self.socketServer);
        self.commandBehavior  = new CommandBehavior().registerSelf(self.socketServer);
    }
}

M2mSupervisor.prototype.start = function(){
    M2mSupervisor.instance = this;
    this.dhclient && this.dhclient.start();
    this.redisWatcher.start();
    return this;
};

M2mSupervisor.prototype.stop = function(){
    this.redisWatcher.stop();
    this.dhclient && this.dhclient.stop();
};

module.exports = M2mSupervisor;