var _ = require('lodash');
var util = require('util');

var ShellWatcher = require('../lib/shell-watcher');

var logger = require('../lib/logger')('wwan');

var MILLIS_PER_SEC = 1000;

function WwanWatcher(config) {
  ShellWatcher.apply(this,[logger,config,true]);
}

util.inherits(WwanWatcher,ShellWatcher);

WwanWatcher.MILLIS_PER_SEC = MILLIS_PER_SEC;

WwanWatcher.prototype._onStart = function(cellular) {
  var self = this;
  self.cellular = cellular;
  self.checkRoutes();
  self.interval = setInterval(_.bind(self.checkRoutes,self),self.cellular.checkInterval * MILLIS_PER_SEC);
};

WwanWatcher.prototype._onStop = function() {
  clearInterval(this.interval);
};

WwanWatcher.prototype.checkRoutes = function() {
  var self = this;
  self.findRoute('wwan1', function (iface) {
    if (iface) {
      logger.info("Cellular interface is up");
      self.routeOutput(true, function (err,output) {
        if (err) {
          logger.error('route error: ' + err);
          self.emit('note','error');
          self.noteReady(false);
        } else {
          self.emit('note','ready'); // TODO get IP
          self.noteReady(true);
        }
      });
    }
    else {
      logger.info("Cellular interface is down, starting it");
      self.psauxOutput(true, function(err,output) {
        if (output && !/wds\-start\-network=/.test(output)) {
          logger.info('starting wwan');
          self.shell.exec('ifup wwan1');
          self.emit('note','wwan');
          self.noteReady(false);
        } else if (err) {
          logger.error('ps aux error: ' + err);
          self.emit('note','error');
          self.noteReady(false);
        } else {
          logger.error('waiting for wwan');
          self.emit('note','waiting');
        }
      });
    }
  });
};

WwanWatcher.prototype.routeOutput = function(refresh, callback) {
  this.getShellOutput('route','route -n', refresh, callback);
};

module.exports = WwanWatcher;
