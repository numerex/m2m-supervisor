var _ = require('lodash');
var logger = require('./logger')('route');

function RouteWatcher(config,note) {
    this.config = _.defaults(config || {},{
        pppInterface:   'ppp0',
        pppSubnet:      '172.29.12.0',
        pppMask:        '255.255.255.0',
        routeInterval:  15*1000
    });
    this.stats = require('./statsd-client')('ppp'); // NOTE - delay 'require' for mocking
    this.shell = require('shelljs');                // NOTE - delay 'require' for mocking
    this.outputs = {};
}

RouteWatcher.prototype.started = function(){
    return !!this.interval;
};

RouteWatcher.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start watcher');
    this.stats.increment('started');

    if (!note) note = function(){};

    var self = this;
    self.checkRoutes(note);
    self.interval = setInterval(function(){ self.checkRoutes(note); },self.config.routeInterval);
    return self;
};

RouteWatcher.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop watcher');
    this.stats.increment('stopped');

    clearInterval(this.interval);
};

RouteWatcher.prototype.checkRoutes = function(note){
    var self = this;
    self.pppstatsOutput(true,function(err,pppstatsOutput){
        if (err) {
            if (err == 1 && pppstatsOutput.indexOf('nonexistent interface') >= 0) {   // EXAMPLE: pppstats: nonexistent interface 'ppp0' specified
                logger.info('starting pppd');
                self.shell.exec('pppd');
                self.stats.increment('start-pppd');
                note('pppd');
            } else {
                logger.error('pppstats error: ' + err);
                self.stats.increment('error');
                note('error');
            }
        } else if (pppstatsOutput.indexOf('PACK VJCOMP  VJUNC') < 0){   // EXAMPLE: IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ
            logger.error('unexpected pppstats output: ' + pppstatsOutput);
            self.stats.increment('error');
            note('error');
        } else {
            self.routeOutput(true,function(err,routeOutput){
                if (err) {
                    self.stats.increment('error');
                    note('error');
                } else if (routeOutput.indexOf(self.config.pppSubnet) >= 0) {
                    note('ready');
                } else {
                    logger.info('add ppp route to GWaaS');
                    self.shell.exec('route add -net ' + self.config.pppSubnet + ' netmask ' + self.config.pppMask + ' dev ' + self.config.pppInterface);
                    self.stats.increment('add-route');
                    note('route');
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
