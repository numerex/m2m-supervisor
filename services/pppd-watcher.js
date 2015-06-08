var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('../lib/logger')('pppd');

var MILLIS_PER_SEC = 1000;

function PppdWatcher(config) {
    Watcher.apply(this,[logger,config,true]);
    this.outputs = {};
    this.shell = require('shelljs');    // NOTE - delay 'require' for mocking
    this.os = require('os');            // NOTE - delay 'require' for mocking
}

util.inherits(PppdWatcher,Watcher);

PppdWatcher.MILLIS_PER_SEC = MILLIS_PER_SEC;


PppdWatcher.prototype._onStart = function(wireless) {
    var self = this;
    self.wireless = wireless;
    self.checkRoutes();
    self.interval = setInterval(function(){ self.checkRoutes(); },self.wireless.checkInterval * MILLIS_PER_SEC);
};

PppdWatcher.prototype._onStop = function() {
    clearInterval(this.interval);
};

PppdWatcher.prototype.checkRoutes = function(){
    var self = this;
    var pppInterface = _.detect(_.keys(self.os.networkInterfaces()),function(iface){ return _.startsWith(iface,'ppp')});
    if (pppInterface)
        self.routeOutput(true,function(err,output){
            if (err) {
                logger.error('route error: ' + err);
                self.emit('note','error');
                self.noteReady(false);
            } else if (output.indexOf(self.wireless.subnet) >= 0) {
                self.emit('note','ready');
                self.noteReady(true);
            } else {
                logger.info('add ppp route to gateway');
                self.shell.exec('route add -net ' + self.wireless.subnet + ' netmask ' + self.wireless.mask + ' dev ' + pppInterface);
                self.emit('note','route');
                self.noteReady(true);
            }
        });
     else
        self.psauxOutput(true,function(err,output){
            if (output && !/pppd/.test(output)) {
                logger.info('starting pppd');
                self.shell.exec('pppd');
                self.emit('note','pppd');
            } else if (err) {
                logger.error('ps aux error: ' + err);
                self.emit('note','error');
                self.noteReady(false);
            } else {
                logger.error('waiting for pppd');
                self.emit('note','waiting');
            }
        });
};

PppdWatcher.prototype.psauxOutput = function(refresh,callback){
    this.getShellOutput('psaux','ps aux',refresh,callback);
};

PppdWatcher.prototype.routeOutput = function(refresh,callback){
    this.getShellOutput('route','route -n',refresh,callback);
};

PppdWatcher.prototype.getShellOutput = function(key,command,refresh,callback){
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

module.exports = PppdWatcher;
