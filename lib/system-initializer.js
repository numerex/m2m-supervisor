var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var events = require('events');

var hashkeys = require('./config-hashkeys');
var schema = require('./redis-schema');

var logger = require('./logger')('sys-init');

function SystemInitializer(config){
    var redis = require('then-redis');                  // NOTE delayed for testing
    var SystemChecker = require('./system-checker');    // NOTE delayed for testing

    var self = this;
    self.checker = new SystemChecker(config).on('ready',function(){
        if (!self.checker.exists.redis) {
            logger.info('unable to configure redis ... please install');
            return self.emit('done',new Error('redis not found'));
        }
        var complete = true;

        if (!self.checker.info.imei) {
            complete = false;
            logger.error('no IMEI found');
        }

        if (!self.checker.choices.controlPort) {
            complete = false;
            logger.error('no modem serial port found');
        }

        self.config = {};
        self.setConfigValue(hashkeys.gateway.imei.key,        self.checker.info.imei);
        self.setConfigValue(hashkeys.system.vendor.key,       self.checker.info.vendor);
        self.setConfigValue(hashkeys.system.model.key,        self.checker.info.model);
        self.setConfigValue(hashkeys.system.version.key,      self.checker.info.version);
        self.setConfigValue(hashkeys.system.imsi.key,         self.checker.info.imsi);
        self.setConfigValue(hashkeys.cellular.serialPort.key, self.checker.choices.controlPort);

        function done(){
            self.emit('done',complete ? null : new Error('initialization incomplete'))
        }

        if (_.keys(self.config).length === 0)
            done();
        else {
            var client = redis.createClient();
            client.hmset(schema.config.key,self.config)
                .error(_.bind(self.finishCallback,self,_))
                .then(done);
            client.quit();
        }
    });

    self.on('done',function(error){
        if (error)
            logger.error('initialization incomplete');
        else
            logger.info('initialization complete');
        self.finishCallback && self.finishCallback(error);
    });

}

util.inherits(SystemInitializer,events.EventEmitter);

SystemInitializer.prototype.initNow = function(finishCallback){
    this.finishCallback = finishCallback || function(){};
    this.checker.checkNow();
};

SystemInitializer.prototype.setConfigValue = function(key,value){
    if (value)
        this.config[key] = value;
    else
        delete this.config[key];
};

module.exports = SystemInitializer;