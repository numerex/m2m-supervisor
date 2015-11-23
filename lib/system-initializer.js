var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var events = require('events');

var schema = require('./redis-schema');
var hashkeys = require('./config-hashkeys');

var logger = require('./logger')('sys-init');

function SystemInitializer(config){
    console.log("here");
    var redis = require('then-redis');                  // NOTE delayed for testing
    var SystemChecker = require('./system-checker');    // NOTE delayed for testing

    var self = this;
    self.checker = new SystemChecker(config).on('ready',function(){

	console.log("system checker is ready");
        if (!self.checker.exists.redis) {
            logger.info('unable to configure redis ... please install');
            self.finishCallback(new Error('redis not found'));
        } else {

            var complete = true;

            if (!self.setup.config[hashkeys.gateway.privateURL.key]) {
                complete = false;
                logger.error('no private gateway URL');
            }

            if (!self.setup.config[hashkeys.gateway.publicURL.key]) {
                complete = false;
                logger.error('no public gateway URL');
            }

            if (!self.setup.config[hashkeys.cellular.subnet.key]) {
                complete = false;
                logger.error('no PPP subnet');
            }

            if (!self.checker.info.imei) {
                complete = false;
                logger.error('no IMEI found');
            }

// JB:  This is not required for qmi
//            if (!self.checker.choices.controlPort) {
//                complete = false;
//                logger.error('no modem serial port found');
//            }

            self.setConfigValue(hashkeys.gateway.imei.key,        self.checker.info.imei);
            self.setConfigValue(hashkeys.system.vendor.key,       self.checker.info.vendor);
            self.setConfigValue(hashkeys.system.model.key,        self.checker.info.model);
            self.setConfigValue(hashkeys.system.version.key,      self.checker.info.version);
            self.setConfigValue(hashkeys.system.imsi.key,         self.checker.info.imsi);

// JB:  This is not required for qmi
//            self.setConfigValue(hashkeys.cellular.serialPort.key, self.checker.choices.controlPort);

            function done(){
                if (complete)
                    self.runScripts();
                else {
                    logger.error('initialization incomplete');
                    self.finishCallback(new Error('initialization incomplete'))
                }
            }

            if (_.keys(self.setup.config).length === 0)
                done();
            else {
                var client = redis.createClient();
                client.hmset(schema.config.key,self.setup.config)
                    .error(_.bind(self.finishCallback,self,_))
                    .then(done);
                client.quit();
            }
        }
    });

}

util.inherits(SystemInitializer,events.EventEmitter);

SystemInitializer.prototype.initNow = function(finishCallback){
    this.finishCallback = finishCallback || function(){};
    try {
        // istanbul ignore next -- default file not testable on CI server
        this.setup = JSON.parse(fs.readFileSync(process.env.M2M_SUPERVISOR_CONFIG || '/etc/m2m-supervisor/setup.json'));
    } catch(e) {
        logger.error('JSON error: ' + e.message);
        this.finishCallback(e);
        return false;
    }
    if (this.setup.config)
        this.checker.checkNow();
    else {
        logger.error('incomplete setup file');
        this.finishCallback(new Error('incomplete setup file'));
    }
    return !!this.setup.config;
};

SystemInitializer.prototype.setConfigValue = function(key,value){
    if (value)
        this.setup.config[key] = value;
    else
        delete this.setup.config[key];
};

SystemInitializer.prototype.runScripts = function(){
    // TODO run scripts...
    logger.info('initialization complete');
    this.finishCallback(null);
};

module.exports = SystemInitializer;