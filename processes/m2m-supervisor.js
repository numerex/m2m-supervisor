var _ = require('lodash');

var DhclientWatcher = require('../services/dhclient-watcher');
var GatewayProxy = require('../services/gateway-proxy');
var RedisWatcher = require('../services/redis-watcher');
var HashWatcher = require('../services/hash-watcher');
var QueueRouter = require('../services/queue-router');
var RouteWatcher = require('../services/route-watcher');
var WwanWatcher = require('../services/wwan-watcher');
var HeartbeatGenerator = require('../services/heartbeat-generator');
var HttpServer = require('../services/http-server');
//var SensorManager = require('../services/sensor-manager'); // Meh

var SocketServer = require('../sockets/socket-server');
var ShellBehavior = require('../sockets/shell-behavior');
var CommandBehavior = require('../sockets/command-behavior');

var NetworkNoter = require('../lib/network-noter');
var SystemInitializer = require('../lib/system-initializer');

var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/config-hashkeys');

function M2mSupervisor(config){

    // istanbul ignore if - only for distinguishing log boundaries at run-time
    if (!process.env.testing) console.log('------------------------------------------------');

    config = config || {};

    var httpPort        = config.httpPort || process.env.PORT || '5000';
    var runWeb          = config.runWeb;
    var runBridge       = config.runBridge;
    var runTransceiver  = config.runTransceiver;
    var runSensorMgr    = true;
    var runAll          = !runWeb && !runBridge && !runTransceiver;

    var self = this;

    self.supervisorProxy = false;
    if (config.runProxy) {
        runBridge = runTransceiver = runAll = false;
        self.supervisorProxy  = runWeb = true;
    }

    if (runWeb || runAll) {
        self.httpServer       = new HttpServer().start(httpPort);
        self.socketServer     = new SocketServer().start(self.httpServer);
        self.shellBehavior    = new ShellBehavior().registerSelf(self.socketServer);
        self.commandBehavior  = new CommandBehavior().registerSelf(self.socketServer);
    }

    self.configWatcher  = new HashWatcher(schema.config.key,hashkeys,config);
    self.redisWatcher   = new RedisWatcher(config);

    if (runBridge || runAll) {
        self.heartbeat  = null;
        self.gateway    = new GatewayProxy(config);
        self.wwan       = new WwanWatcher(config);
        self.dhclient   = new DhclientWatcher(config);

        self.redisWatcher.once('ready',function(client){
            nowOrLaterNoteNetwork(self.dhclient,client,'eth0',hashkeys.system.publicIP.key,hashkeys.system.publicMAC.key);
            nowOrLaterNoteNetwork(self.wwan,    client,'wwan1',hashkeys.system.privateIP.key);
        });

        self.configWatcher
        .addKeysetWatcher('gateway',  true, self.gateway)
        .addKeysetWatcher('cellular', true, self.wwan);

        self.configWatcher.once('change',function(){
            if (!self.configWatcher.ready()) new SystemInitializer().initNow();
        });

        self.wwan.on('ready',function(ready){
          if (ready && !self.heartbeat) {
            self.heartbeat = new HeartbeatGenerator(self.gateway,config);
            self.configWatcher.addKeysetWatcher('gateway',true,self.heartbeat);
          }
	  //            self.modem.ensureStartStop(ready ? self.pppd.cellular : null);
          self.heartbeat && self.heartbeat.ensureStartStop(ready ? self.gateway.config : null,self.redisWatcher.client);
        });

    }

    if (runTransceiver || runAll) {
      self.queueRouter = new QueueRouter(config);
      self.configWatcher.addKeysetWatcher('gateway',true,self.queueRouter);
      self.routeWatcher = new RouteWatcher(self.queueRouter);
      self.redisWatcher.addClientWatcher(self.routeWatcher);
    }

/*
    if (runSensorMgr || runAll) {
      // stub out giving sensor manager some config
      self.sensorManager = new SensorManager(self.gateway,
					    config);
    }
*/

    self.redisWatcher.addClientWatcher(self.configWatcher);
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

function nowOrLaterNoteNetwork(watcher,client,iface,addressKey,macKey){
    var noter = new NetworkNoter(client,iface,addressKey,macKey);
    if (watcher.ready())
        noter.noteNow();
    else
        watcher.once('ready', _.bind(noter.noteNow,noter));
}

module.exports = M2mSupervisor;