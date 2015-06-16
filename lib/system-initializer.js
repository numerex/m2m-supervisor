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
    var FtpSetup = require('./ftp-setup');              // NOTE delayed for testing

    var self = this;
    self.shell = require('shelljs');                    // NOTE delayed for testing

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

        new FtpSetup(self.checker.info.imei).setupNow(function(error){
            if (!self.resetSetup()) return;

            if (!self.checker.choices.controlPort) {
                complete = false;
                logger.error('no modem serial port found');
            }

            if (!self.config[hashkeys.gateway.privateURL.key]) {
                complete = false;
                logger.error('no private gateway URL');
            }

            if (!self.config[hashkeys.gateway.publicURL.key]) {
                complete = false;
                logger.error('no public gateway URL');
            }

            if (!self.config[hashkeys.cellular.subnet.key]) {
                complete = false;
                logger.error('no PPP subnet');
            }

            self.setConfigValue(hashkeys.gateway.imei.key,        self.checker.info.imei);
            self.setConfigValue(hashkeys.system.vendor.key,       self.checker.info.vendor);
            self.setConfigValue(hashkeys.system.model.key,        self.checker.info.model);
            self.setConfigValue(hashkeys.system.version.key,      self.checker.info.version);
            self.setConfigValue(hashkeys.system.imsi.key,         self.checker.info.imsi);
            self.setConfigValue(hashkeys.cellular.serialPort.key, self.checker.choices.controlPort);

            function done(){
                if (complete)
                    self.emit('runScripts');
                else
                    self.emit('done',new Error('initialization incomplete'))
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
    });

    self.on('runScripts', _.bind(self.nextScript,self));
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

    if (!this.resetSetup()) return false;

    if (this.config)
        this.checker.checkNow();
    else {
        logger.error('incomplete setup file');
        this.emit('done',new Error('incomplete setup file'));
    }
    return !!this.config;
};

SystemInitializer.prototype.resetSetup = function(){
    var setup = require('./global-setup');
    setup.reset();

    if (setup.error) {
        logger.error('setup error: ' + setup.error.message);
        this.emit('done',setup.error);
        return false;
    }

    this.config = setup.setup.config;
    this.scripts = setup.setup.scripts || [];
    return true;
};

SystemInitializer.prototype.setConfigValue = function(key,value){
    if (value)
        this.config[key] = value;
    else
        delete this.config[key];
};

SystemInitializer.prototype.nextScript = function(){
    var self = this;
    var script = self.scripts.shift();
    if (!script) return self.emit('done',null);

    logger.info('run: ' + script);
    try {
        self.shell.exec(script,{silent: false},function(code,output) {
            logger.info('result: ' + code);
            self.emit('done',code === 0 ? null : new Error('script result - ' + code))
        });
    }
    catch(error) {
        // istanbul ignore next -- not sure how to generate this error; does shelljs even trigger it??
        logger.error('shell error: ' + error.message);
        // istanbul ignore next
        self.emit('done',error);
    }
};

module.exports = SystemInitializer;