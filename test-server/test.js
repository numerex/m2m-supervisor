var _ = require('lodash');

module.exports.chai = require('chai');
module.exports.should = module.exports.chai.should();
module.exports.expect = module.exports.chai.expect;
module.exports.pp = require(process.cwd() + '/lib/bunyan-prettyprinter');
module.exports.mockery = require('mockery');
module.exports.timekeeper = require('timekeeper');

require(process.cwd() + '/lib/logger')('test      ').info('test environment loaded: ' + process.cwd());

module.exports.matchArrays = function(actual,expected){
    actual.length.should.equal(expected.length);
    for(var index = 0; index < actual.length; index++) {
        if (typeof expected[index] === 'string')
            actual[index].should.eql(expected[index]);
        else
            actual[index].should.match(expected[index]);
    }
};

function MockEventHandler(){
    this.eventHandlers = {};
}

MockEventHandler.prototype.on = function(event,callback){
    this.eventHandlers[event] = callback;
};

// DRAM -----------------------

module.exports.mockdgram = function() {
    var self = this;
    self.deliveries = [];
    self.createSocket = function(argument) {
        var socket = {
            events: {},
            socketType: argument,
            closed: false,
            address: function() { return {address: 'localhost',port: 1000}; }
        };
        socket.bind = function(port){
            socket.port = port;
        };
        socket.on = function(event,callback) {
            socket.events[event] = callback;
        };
        socket.send = function(data,start,end,port,host) {
            self.deliveries.push([data,start,end,port,host]);
        };
        socket.close = function () {
            socket.closed = true;
            socket.events.close();
        };
        return socket;
    };
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

module.exports.mockshelljs = {
    calls: [],
    processes: []
};

module.exports.mockshelljs.reset = function(){
    module.exports.mockshelljs.processes = [];
    module.exports.mockshelljs.lookup = {};
};

module.exports.mockshelljs.newMockProcess = function(){
    var process = new MockEventHandler();
    process.id = module.exports.mockshelljs.processes.length;
    process.stdin = new MockEventHandler();
    process.stdout = new MockEventHandler();
    process.stderr = new MockEventHandler();
    process.kill = function(signal){
        module.exports.mockshelljs.calls.push({id: process.id,kill: signal});
        process.eventHandlers.exit && process.eventHandlers.exit(null,signal);
        process.eventHandlers.close && process.eventHandlers.close(null,signal);
    };
    process.snapshot = function(){
        return {
            id: process.id,
            events: _.keys(process.eventHandlers),
            stdin: _.keys(process.stdin.eventHandlers),
            stdout: _.keys(process.stdout.eventHandlers),
            stderr: _.keys(process.stderr.eventHandlers)
        };
    };
    module.exports.mockshelljs.processes.push(process);
    return process;
};

module.exports.mockshelljs.exec = function() {
    var command = arguments[0];
    var response = module.exports.mockshelljs.lookup[command];
    if (!response) throw(new Error('no response found: ' + command));

    var process = module.exports.mockshelljs.newMockProcess();
    module.exports.mockshelljs.calls.push({id: process.id,exec: [command,response]});

    var lastArgument = arguments[arguments.length - 1];
    switch(typeof lastArgument){
        case 'object':
            if (lastArgument && lastArgument.async) break;

        case 'string':
            return {code: 0,output: response};

        case 'function':
            lastArgument(response[0],response[1]);
    }
    return process;
};

module.exports.mockshelljs.snapshot = function(){
    var result = module.exports.mockshelljs.calls;
    module.exports.mockshelljs.calls = [];
    return result;
};


// REDIS ----------------------

var MockRedis = {events: {},calls: []};

MockRedis.reset = function(){
    MockRedis.clientException = null;
    MockRedis.events = {};
    MockRedis.errors = {};
    MockRedis.results = [];
    MockRedis.lookup = {
        brpop: [],
        keys: {},
        get: {},
        hgetall: {},
        hmset: {},
        llen: {},
        lpush: {}
    };
};

MockRedis.snapshot = function(){
    var result = MockRedis.calls;
    MockRedis.calls = [];
    return result;
};

MockRedis.createClient = function () {
    var internalClient = {
        end: function(){
            MockRedis.calls.push({end: null});
        }
    };
    var client = {
        _redisClient: internalClient,
        send: function(name,args) {
            return (client[name])(args);
        },
        then: function(callback) {
            if (!MockRedis.clientException){
                var result = MockRedis.results;
                MockRedis.results = null;
                callback(result);
            }
            return client;
        },
        error: function(callback){
            if (MockRedis.clientException){
                MockRedis.events.error && MockRedis.events.error(MockRedis.clientException);
                callback(MockRedis.clientException);
            }
            return client;
        },
        done: function(){},
        on: function(event,callback) {
            MockRedis.events[event] = callback;
            MockRedis.results = null;
            return client;
        },
        brpop: function(args) {
            MockRedis.calls.push({brpop: args});
            MockRedis.results = MockRedis.lookup.brpop.pop() || null;
            return client;
        },
        del: function(args){
            MockRedis.calls.push({del: args});
            _.each(args,function(key){
                MockRedis.lookup.get[key] = null;
            });
            MockRedis.results = null;
            return client;
        },
        get: function(key) {
            MockRedis.calls.push({get: key});
            MockRedis.results = MockRedis.lookup.get[key] || '0';
            return client;
        },
        hdel: function(args){
            MockRedis.calls.push({hdel: args});
            MockRedis.results = null;
            return client;
        },
        hgetall: function(key){
            MockRedis.calls.push({hgetall: key});
            MockRedis.results = MockRedis.lookup.hgetall[key];
            return client;
        },
        hmset: function(args){
            MockRedis.calls.push({hmset: args});
            MockRedis.results = null;
            return client;
        },
        incr: function(key) {
            MockRedis.calls.push({incr: key});
            var value = +(MockRedis.lookup.get[key] || '0') + 1;
            MockRedis.lookup.get[key] = value.toString();
            MockRedis.results = MockRedis.lookup.get[key];
            return client;
        },
        keys: function(pattern) {
            MockRedis.calls.push({keys: pattern});
            MockRedis.results = MockRedis.lookup.keys[pattern] || [];
            return client;
        },
        llen: function(key) {
            MockRedis.calls.push({llen: key});
            MockRedis.results = MockRedis.lookup.llen[key] || '0';
            return client;
        },
        lpush: function(key,value) {
            MockRedis.calls.push({lpush: [key,value]});
            var list = MockRedis.lookup.lpush[key] = MockRedis.lookup.lpush[key] || [];
            list.unshift(value);
            MockRedis.results = null;
            return client;
        },
        mget: function(args){
            MockRedis.calls.push({mget: args});
            MockRedis.results = _.map(args,function(key){ return MockRedis.lookup.get[key] || null; });
            return client;
        },
        mset: function(){
            var args = _.toArray(arguments);
            if (args.length == 1 && _.isArray(args[0])) args = args[0];

            var key = null;
            _.each(args,function(element){
                if (!key)
                    key = element;
                else {
                    MockRedis.lookup.get[key] = element;
                    key = null;
                }
            });
            MockRedis.calls.push({mset: args});
            MockRedis.results = null;
            return client;
        },
        set: function(key,value){
            MockRedis.calls.push({set: [key,value]});
            MockRedis.lookup.get[key] = value;
            MockRedis.results = null;
            return client;
        },
        quit: function(){
            MockRedis.calls.push({quit: null});
            MockRedis.results = null;
            return client;
        }
    };
    return client;
};

module.exports.mockredis = MockRedis;

// SOCKET.IO ----------------------

var mockSocketIO = {
    httpServer: null,
    calls: []
};

mockSocketIO.on = function(event,callback) {
    mockSocketIO.eventHandlers[event] = callback;
};

mockSocketIO.reset = function(){
    mockSocketIO.httpServer = null;
    mockSocketIO.eventHandlers = {};
    mockSocketIO.sockets = [];
};

mockSocketIO.newMockSocket = function(){
    var mockSocket = {
        socketID: mockSocketIO.sockets.length,
        eventHandlers: {}
    };
    mockSocket.on = function(event,callback){
        mockSocket.eventHandlers[event] = callback;
    };
    mockSocket.emit = function(event,data){
        var args = {socket: mockSocket.socketID};
        args[event] = data;
        mockSocketIO.calls.push({emit: args});
    };
    mockSocketIO.sockets.push(mockSocket);
    return mockSocket;
};

module.exports.mocksocketio = function (httpServer){
    mockSocketIO.reset();
    mockSocketIO.httpServer = httpServer;
    return mockSocketIO;
};

module.exports.mocksocketio.model = mockSocketIO;

module.exports.mocksocketio.reset = function(){
    mockSocketIO.reset();
};

module.exports.mocksocketio.snapshot = function(){
    var calls = mockSocketIO.calls;
    mockSocketIO.calls = [];
    return {
        events: _.keys(mockSocketIO.eventHandlers),
        sockets: _.map(mockSocketIO.sockets,function(socket){
            return {id: socket.socketID,events: _.keys(socket.eventHandlers)};
        }),
        calls: calls
    };
};

process.env.testing = true;

