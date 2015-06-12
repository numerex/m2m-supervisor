var _ = require('lodash');

var schema = require('./redis-schema');

function NetworkNoter(client,iface,addressKey,macKey){
    this.client     = client;
    this.iface      = iface;
    this.addressKey = addressKey;
    this.macKey     = macKey;
    this.os         = require('os'); // NOTE delayed for testing
}

NetworkNoter.prototype.noteNow = function(){
    var ifaces = this.os.networkInterfaces();
    var info = _.detect(ifaces[this.iface],function(option){ return option.family === 'IPv4'; });
    if (!info) return false;

    var values = {};
    if (this.addressKey && info.address)    values[this.addressKey] = info.address;
    if (this.macKey && info.mac)            values[this.macKey]     = info.mac;
    if (_.keys(values).length === 0) return false;

    this.client.hmset(schema.config.key,values);
    return true;
};

module.exports = NetworkNoter;