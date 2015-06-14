var _ = require('lodash');
var util = require('util');

var HashWatcher = require('./hash-watcher');
var RedisWatcher = require('./redis-watcher');
var PeripheralRouter = require('./peripheral-router');

var schema = require('../lib/redis-schema');
var hashkeys = require('../lib/config-hashkeys');

var logger = require('../lib/logger')('config');

function ConfigWatcher(config) {
    HashWatcher.apply(this,[schema.config.key,hashkeys,config]);

    if (ConfigWatcher.instance) {
        ConfigWatcher.instance.removeAllListeners();
        logger.info('instance removed');
    }

    ConfigWatcher.instance = this;
    logger.info('instance created');
}

util.inherits(ConfigWatcher,HashWatcher);

module.exports = ConfigWatcher;

