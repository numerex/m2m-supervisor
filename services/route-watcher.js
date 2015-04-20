var _ = require('lodash');
var util = require('util');
var events = require('events');

var logger = require('../lib/logger')('route');

function RouteWatcher(config) {
    this.config = _.defaults(config || {},{
        pppInterface:   'ppp0',
        pppSubnet:      '172.29.12.0',
        pppMask:        '255.255.255.0',
        routeInterval:  15*1000
    });
    this.stats = require('../lib/statsd-client')('ppp');    // NOTE - delay 'require' for mocking
    this.shell = require('shelljs');                        // NOTE - delay 'require' for mocking
    this.outputs = {};
}

util.inherits(RouteWatcher,events.EventEmitter);

RouteWatcher.prototype.started = function(){
    return !!this.interval;
};

RouteWatcher.prototype.start = function() {
    if (this.started()) throw(new Error('already started'));

    logger.info('start watcher');
    this.stats.increment('started');

    var self = this;
    self.checkRoutes();
    self.interval = setInterval(function(){ self.checkRoutes(); },self.config.routeInterval);
    return self;
};

RouteWatcher.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watcher');
    this.stats.increment('stopped');

    clearInterval(this.interval);
};

RouteWatcher.prototype.checkRoutes = function(){
    var self = this;
    self.pppstatsOutput(true,function(err,pppstatsOutput){
        if (err) {
            if (err == 1 && pppstatsOutput.indexOf('nonexistent interface') >= 0) {   // EXAMPLE: pppstats: nonexistent interface 'ppp0' specified
                logger.info('starting pppd');
                self.shell.exec('pppd');
                self.stats.increment('start-pppd');
                self.emit('note','pppd');
            } else {
                logger.error('pppstats error: ' + err);
                self.stats.increment('error');
                self.emit('note','error');
            }
        } else if (pppstatsOutput.indexOf('PACK VJCOMP  VJUNC') < 0){   // EXAMPLE: IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ
            logger.error('unexpected pppstats output: ' + pppstatsOutput);
            self.stats.increment('error');
            self.emit('note','error');
        } else {
            self.routeOutput(true,function(err,routeOutput){
                if (err) {
                    self.stats.increment('error');
                    self.emit('note','error');
                } else if (routeOutput.indexOf(self.config.pppSubnet) >= 0) {
                    self.emit('note','ready');
                    self.emit('ready');
                } else {
                    logger.info('add ppp route to GWaaS');
                    self.shell.exec('route add -net ' + self.config.pppSubnet + ' netmask ' + self.config.pppMask + ' dev ' + self.config.pppInterface);
                    self.stats.increment('add-route');
                    self.emit('note','route');
                }
            });
        }
    });
};

RouteWatcher.prototype.pppstatsOutput = function(refresh,callback){
    this.getShellOutput('pppstats','pppstats',refresh,callback);
};

RouteWatcher.prototype.routeOutput = function(refresh,callback){
    this.getShellOutput('route','route -n',refresh,callback);
};

RouteWatcher.prototype.getShellOutput = function(key,command,refresh,callback){
    var self = this;
    if (refresh) self.outputs[key] = null;

    if (self.outputs[key])
        callback(null,self.outputs[key]);
    else
        try {
            self.shell.exec(command,{silent: true},function(code,output) {
                if (code === 0)
                    callback(null,self.outputs[key] = output);
                else
                    callback(code,output);
            });
        } catch(e) {
            callback(e,null);
        }
};

module.exports = RouteWatcher;
