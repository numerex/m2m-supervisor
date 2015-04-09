module.exports.chai = require('chai');
module.exports.should = module.exports.chai.should();
module.exports.expect = module.exports.chai.expect;
module.exports.pp = require(process.cwd() + '/lib/bunyan-prettyprinter');
module.exports.mockery = require('mockery');

require(process.cwd() + '/lib/logger')('test      ').info('test environment loaded');

// DRAM -----------------------

module.exports.mockdgram = function() {
    var self = this;
    self.closed = false;
    self.socketType = null;
    self.events = {};
    self.deliveries = [];
    self.createSocket = function(argument) {
        self.socketType = argument;
        return self;
    };
    self.address = function(){
        return {address: 'localhost',port: 1000};
    };
    self.bind = function(port){
        self.port = port;
    };
    self.on = function(event,callback) {
        self.events[event] = callback;
    };
    self.send = function() {
        self.deliveries.push(arguments);
    };
    self.close = function () {
        self.closed = true;
    }
};

// LYNX -----------------------

module.exports.mocklynx = function(host,port,options) {
    var mock = {};

    module.exports.mocklynx.options = options;
    module.exports.mocklynx.calls = [];
    
    mock.increment = function(name){
        module.exports.mocklynx.calls.push({increment: name});
    };

    mock.gauge = function(name,value){
        module.exports.mocklynx.calls.push({gauge: name,value: value});
    };

    mock.send = function(object){
        module.exports.mocklynx.calls.push({send: object});
    };
    
    return mock;
};

module.exports.mocklynx.snapshot = function() {
    var result = module.exports.mocklynx.calls;
    module.exports.mocklynx.calls = [];
    return result;
};

// SHELLJS ---------------------

module.exports.mockshelljs = {};

module.exports.mockshelljs.reset = function(){
    module.exports.mockshelljs.lookup = {};
};

module.exports.mockshelljs.exec = function() {
    var command = arguments[0];
    var response = module.exports.mockshelljs.lookup[command];
    if (!response) throw(new Error('no response found: ' + command));

    var lastArgument = arguments[arguments.length - 1];
    switch(typeof lastArgument){
        case 'object':
        case 'string':
            return {output: response};
        case 'function':
            lastArgument(response[0],response[1]);
    }
};

// REDIS ----------------------

module.exports.mockredis = {calls: []};

module.exports.mockredis.reset = function(){
    module.exports.clientException = null;
    module.exports.mockredis.lookup = {
        get: {},
        hgetall: {},
        llen: {},
        lpush: {}
    };
    module.exports.mockredis.errors = {};
};

module.exports.mockredis.snapshot = function(){
    var result = module.exports.mockredis.calls;
    module.exports.mockredis.calls = [];
    return result;
};

module.exports.mockredis.createClient = function () {
    if (module.exports.clientException) throw(new Error(module.exports.clientException));
    return {
        get: function(key,callback) {
            module.exports.mockredis.calls.push({get: key});
            callback(module.exports.mockredis.errors[key] || null,module.exports.mockredis.lookup.get[key] || '0');
        },
        hgetall: function(key,callback){
            module.exports.mockredis.calls.push({hgetall: key});
            callback(module.exports.mockredis.errors[key] || null,module.exports.mockredis.lookup.hgetall[key]);
        },
        llen: function(key,callback) {
            module.exports.mockredis.calls.push({llen: key});
            callback(module.exports.mockredis.errors[key] || null,module.exports.mockredis.lookup.llen[key] || '0');
        },
        lpush: function(key,value,callback) {
            module.exports.mockredis.calls.push({lpush: [key,value]});
            var list = module.exports.mockredis.lookup.lpush[key] = module.exports.mockredis.lookup.lpush[key] || [];
            callback(module.exports.mockredis.errors[key] || null,list.unshift('value'));
        },
        quit: function(){
            module.exports.mockredis.calls.push({quit: null});
        }
    }
};

process.env.testing = true;

