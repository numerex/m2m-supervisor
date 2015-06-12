var _ = require('lodash');
var util = require('util');

var ShellWatcher = require('../lib/shell-watcher');

var logger = require('../lib/logger')('pppd');

var MILLIS_PER_SEC = 1000;

function PppdWatcher(config) {
    ShellWatcher.apply(this,[logger,config,true]);
}

util.inherits(PppdWatcher,ShellWatcher);

PppdWatcher.MILLIS_PER_SEC = MILLIS_PER_SEC;


PppdWatcher.prototype._onStart = function(cellular) {
    var self = this;
    self.cellular = cellular;
    self.checkRoutes();
    self.interval = setInterval(_.bind(self.checkRoutes,self),self.cellular.checkInterval * MILLIS_PER_SEC);
};

PppdWatcher.prototype._onStop = function() {
    clearInterval(this.interval);
};

PppdWatcher.prototype.checkRoutes = function(){
    var self = this;
    self.findRoute('ppp',function(iface){
        if (iface)
            self.routeOutput(true,function(err,output){
                if (err) {
                    logger.error('route error: ' + err);
                    self.emit('note','error');
                    self.noteReady(false);
                } else if (output.indexOf(self.cellular.subnet) >= 0) {
                    self.emit('note','ready'); // TODO get IP
                    self.noteReady(true);
                } else {
                    logger.info('add ppp route to gateway');
                    self.shell.exec('route add -net ' + self.cellular.subnet + ' netmask ' + self.cellular.mask + ' dev ' + iface);
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
                    self.noteReady(false);
                } else if (err) {
                    logger.error('ps aux error: ' + err);
                    self.emit('note','error');
                    self.noteReady(false);
                } else {
                    logger.error('waiting for pppd');
                    self.emit('note','waiting');
                }
            });
    });
};

PppdWatcher.prototype.routeOutput = function(refresh,callback){
    this.getShellOutput('route','route -n',refresh,callback);
};

module.exports = PppdWatcher;
