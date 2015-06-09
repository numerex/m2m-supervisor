var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

function ShellWatcher(logger,config,noReadyRetry) {
    Watcher.apply(this,[logger,config,noReadyRetry]);
    this.outputs = {};
    this.shell = require('shelljs');    // NOTE - delay 'require' for mocking
    this.os = require('os');            // NOTE - delay 'require' for mocking
}

util.inherits(ShellWatcher,Watcher);

ShellWatcher.prototype.findRoute = function(prefix,callback){
    callback(_.detect(_.keys(this.os.networkInterfaces()),function(iface){ return _.startsWith(iface,prefix)}));
};

ShellWatcher.prototype.psauxOutput = function(refresh,callback){
    this.getShellOutput('psaux','ps aux',refresh,callback);
};

ShellWatcher.prototype.getShellOutput = function(key,command,refresh,callback){
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

module.exports = ShellWatcher;
