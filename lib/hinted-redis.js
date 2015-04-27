var logger = require('../lib/logger')('promise');

var Promise = require('then-redis/utils/Promise');
Promise.prototype.errorHint = function(label) { return this.error(function(error){ logger.error('error(' + label + '): ' + error); })};
Promise.prototype.thenHint = function(label,callback) { return this.then(callback).errorHint(label); };

module.exports = require('then-redis');