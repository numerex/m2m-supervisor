var _ = require('lodash');
var util = require('util');

var ShellWatcher = require('../lib/shell-watcher');

var logger = require('../lib/logger')('dhclient');

function DhclientWatcher(config) {
    ShellWatcher.apply(this,[logger,config,true]);
    this.checkInterval = (config || {}).checkInterval || 15 * 1000;
}

util.inherits(DhclientWatcher,ShellWatcher);

DhclientWatcher.prototype._onStart = function() {
    var self = this;
    self.checkRoutes();
    self.interval = setInterval(_.bind(self.checkRoutes,self),self.checkInterval);
};

DhclientWatcher.prototype._onStop = function() {
    clearInterval(this.interval);
};

DhclientWatcher.prototype.checkRoutes = function(){
    var self = this;
    self.findRoute('eth',function(iface){
        if (iface) {
            self.emit('note','ready');
            self.noteReady(true);
        } else
            self.psauxOutput(true,function(err,output){
                if (output && !/dhclient/.test(output)) {
                    logger.info('starting dhclient');
                    self.shell.exec('dhclient -v eth0',function(){
                        console.log('done!');
                    });
                    self.emit('note','dhclient');
                } else if (err) {
                    logger.error('ps aux error: ' + err);
                    self.emit('note','error');
                    self.noteReady(false);
                } else {
                    logger.error('waiting for dhclient');
                    self.emit('note','waiting');
                }
            });
    });
};

module.exports = DhclientWatcher;
