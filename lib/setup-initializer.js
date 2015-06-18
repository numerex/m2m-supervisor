var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var events = require('events');

var hashkeys = require('./config-hashkeys');
var schema = require('./redis-schema');

var logger = require('./logger')('setup-init');

function SetupInitializer(imei,config){
    var FtpSetup = require('./ftp-setup');              // NOTE delayed for testing

    var self = this;
    self.redis = require('then-redis');                 // NOTE delayed for testing
    self.shell = require('shelljs');                    // NOTE delayed for testing
    self.ftpsetup = new FtpSetup(imei);

    self.on('runScripts', _.bind(self.nextScript,self));
    self.on('done',function(error){
        if (error)
            logger.error('initialization incomplete');
        else
            logger.info('initialization complete');
        self.finishCallback && self.finishCallback(error);
    });

}

util.inherits(SetupInitializer,events.EventEmitter);

SetupInitializer.prototype.initNow = function(finishCallback){
    var self = this;
    self.finishCallback = finishCallback || function(){};

    self.ftpsetup.setupNow(function(error){
        if (!self.resetSetup()) return;

        var complete = true;
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

        function done(){
            if (complete)
                self.emit('runScripts');
            else
                self.emit('done',new Error('initialization incomplete'))
        }

        if (_.keys(self.config).length === 0)
            done();
        else {
            var client = self.redis.createClient();
            client.hmset(schema.config.key,self.config)
                .error(_.bind(self.finishCallback,self,_))
                .then(done);
            client.quit();
        }
    });
};

SetupInitializer.prototype.resetSetup = function(){
    var setup = require('./global-setup').reset();

    if (setup.error) {
        logger.error('setup error: ' + setup.error.message);
        this.emit('done',setup.error);
        return false;
    }

    this.config = setup.setup.config || {};
    this.scripts = setup.setup.scripts || [];
    return true;
};

SetupInitializer.prototype.nextScript = function(){
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

module.exports = SetupInitializer;