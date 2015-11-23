// qmicli counterparts
// vendor,  --dms-get-manufactuer
// model,   --dms-get-model
// version, --dms-get-revision
// imsi,    --dms-uim-get-imsi
// imei,    --dms-get-ids
// rssi,    --nas-get-signal-strength
var cp     = require("child_process");
var events = require('events');
var util   = require('util');
var fs     = require('fs');
var logger = require('./logger')('qmi-modem');

// Unfortunately this is required, simultaneous calls
// to qmicli, even with --device-open-proxy can get the
// QMI layer in a protocol error state.  Take a semaphore
// to prevent qmicli calls being made simultaneously
var sem    = require('semaphore')(1);

MODEM_PORT = '/dev/cdc-wdm1';
QMICLI_CMD = '/usr/bin/qmicli -d ' + MODEM_PORT;

function QmiModem (config) {
  config = config || {};
  var self = this;

  self.verbose = !!config.verbose;

  self.on('ready', function() {
    if (self.verbose) logger.info('ready');
  });

  self.on('check', function(item,value) {
    if (self.verbose) logger.info('check:' + item + ' ' + value);
    if (++self.resultCount === self.expectCount) self.emit('ready');
  });
}

util.inherits(QmiModem, events.EventEmitter);

QmiModem.prototype.check = function() {
  var self = this;

  fs.access(MODEM_PORT, fs.R_OK | fs.W_OK, function(err) {
    if (err) {
      logger.error(MODEM_PORT + ' not available:  ' + err);
    } else {
      self.resultCount = 0;
      self.expectCount = 6;
      
      self.queryVendor();
      self.queryModel();
      self.queryVersion();
      self.queryImsi();
      self.queryImei();
      self.queryRssi();
    }
  });
}

QmiModem.prototype.queryVendor = function() {
  var self = this;

  sem.take(function() {
    cp.exec(QMICLI_CMD + " --dms-get-manufacturer", function(err, stdout, stderr) {

      var regex   = new RegExp(/Manufacturer:\s'(.*)'/);
      var matches = stdout.match(regex);
      self.vendor = matches[1];
      self.emit('check', 'vendor', self.vendor);
      sem.leave();
      
    });
  });
}

QmiModem.prototype.queryModel = function() {
  var self = this;

  sem.take(function() {
    cp.exec(QMICLI_CMD + " --dms-get-model", function(err, stdout, stderr) {
      
      var regex   = new RegExp(/Model:\s'(.*)'/);
      var matches = stdout.match(regex);
      self.model = matches[1];
      self.emit('check', 'model', self.model);
      sem.leave();
    });
  });
}

QmiModem.prototype.queryVersion = function() {
  var self = this;
  sem.take(function() {
    cp.exec(QMICLI_CMD + " --dms-get-revision", function(err, stdout, stderr) {
      var regex   = new RegExp(/Revision:\s'(.*)'/);
      var matches = stdout.match(regex);
      self.version = matches[1];
      self.emit('check', 'version', self.revision);
      sem.leave();
    });
  });
}

QmiModem.prototype.queryImsi = function() {
  var self = this;

  sem.take(function() {
    cp.exec(QMICLI_CMD + " --dms-uim-get-imsi", function(err, stdout, stderr) {
      
      var regex   = new RegExp(/IMSI:\s'(.*)'/);
      var matches = stdout.match(regex);
      self.imsi = matches[1];
      self.emit('check', 'imsi', self.imsi);
      sem.leave();
    });
  });
}

QmiModem.prototype.queryImei = function() {
  var self = this;

  sem.take(function() {
    cp.exec(QMICLI_CMD + " --dms-get-ids", function(err, stdout, stderr) {
      
      var regex   = new RegExp(/IMEI:\s'(.*)'/);
      var matches = stdout.match(regex);
      self.imei = matches[1];
      self.emit('check', 'imei', self.imei);
      sem.leave();
    });
  });
}


QmiModem.prototype.queryRssi = function() {
  var self = this;

  // --nas-get-signal-strength returns something formatted like:
  // Current:
  //	Network 'umts': '-78 dBm'
  // Other:
  //	Network 'cdma-1xevdo': '-125 dBm'
  // RSSI:
  //	Network 'umts': '-78 dBm'
  //	Network 'cdma-1xevdo': '-125 dBm'
  // ECIO:
  //	Network 'umts': '-7.0 dBm'
  //	Network 'cdma-1xevdo': '-2.5 dBm'
  // IO: '-106 dBm'
  // SINR: (8) '9.0 dB'

  // We want to get the current network RSSI, which is provided on the second line,
  // so the first match on Network should be sufficient

  sem.take(function() {
    cp.exec(QMICLI_CMD + " --nas-get-signal-strength", function(err, stdout, stderr) {
      
      var lines   = stdout.split("\n");

      for (var i = 0; i < lines.length; i++) {
	var regex   = new RegExp(/Network\s'(.*)':\s'(.*)'/);
	var matches = lines[i].match(regex);
	if (matches) {
	  self.rssi = matches[2];
	  self.emit('check', 'rssi', self.rssi);
	  sem.leave();
	  return;
	}
      }
    });
  });
}


module.exports = QmiModem;


