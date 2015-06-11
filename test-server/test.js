var _ = require('lodash');

module.exports.chai = require('chai');
module.exports.should = module.exports.chai.should();
module.exports.expect = module.exports.chai.expect;
module.exports.pp = require(process.cwd() + '/lib/bunyan-prettyprinter');
module.exports.mockery = require('mockery');
module.exports.timekeeper = require('timekeeper');

logger = require(process.cwd() + '/lib/logger')('test      ');
logger.info('test environment loaded: ' + process.cwd());

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

// NET ------------------------

var MockNet = {
    connectException: null,
    writeException: null,
    calls: [],
    events: {},
    connect: function(args,callback){
        _.defer(function(){
            if (MockNet.connectException)
                MockNet.events.error && MockNet.events.error(new Error(MockNet.connectException));
            else {
                MockNet.calls.push({connect: args});
                callback && callback(null);
            }
        });
        return MockNet;
    },
    on: function(event,callback){
        MockNet.events[event] = callback;
        return MockNet;
    },
    write: function(buffer,callback){
        if (MockNet.writeException) throw(new Error(MockNet.writeException));
        MockNet.calls.push({write: buffer});
        callback && callback();
    },
    end: function(){
        MockNet.calls.push({end: null});
    },
    reset: function(){
        MockNet.connectException = null;
        MockNet.writeException = null;
        MockNet.calls = [];
        MockNet.events = {};
    },
    snapshot: function(){
        var result = MockNet.calls;
        MockNet.calls = [];
        return result;
    }
};
module.exports.mocknet = MockNet;

// SERIALPORT ------------------------

var MockSerialPort = {
    connectException: null,
    openException: null,
    writeException: null,
    calls: [],
    events: {},
    reset: function(){
        MockSerialPort.connectException = null;
        MockSerialPort.openException = null;
        MockSerialPort.writeException = null;
        MockSerialPort.calls = [];
        MockSerialPort.events = {};
    },
    snapshot: function(){
        var result = MockSerialPort.calls;
        MockSerialPort.calls = [];
        return result;
    }
};

function SerialPort(port,options,arg3){
    if (MockSerialPort.connectException) throw(new Error(MockSerialPort.connectException));
    MockSerialPort.calls.push({create: [port,options,arg3]});
}

SerialPort.prototype.open = function(callback){
    MockSerialPort.calls.push({open: MockSerialPort.openException});
    MockSerialPort.events.open && MockSerialPort.events.open(MockSerialPort.openException);
    callback(MockSerialPort.openException);
    return this;
};

SerialPort.prototype.close = function(){
    MockSerialPort.calls.push({close: null});
    MockSerialPort.events.close && MockSerialPort.events.close();
};

SerialPort.prototype.on = function(event,callback){
    MockSerialPort.events[event] = callback;
    return this;
};

SerialPort.prototype.write = function(buffer,callback){
    if (MockSerialPort.writeException) throw(new Error(MockSerialPort.writeException));
    MockSerialPort.calls.push({write: buffer});
    callback && callback();
};

MockSerialPort.SerialPort = SerialPort;

module.exports.mockserialport = MockSerialPort;

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
            _.defer(function(){ lastArgument(response[0],response[1]); });
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
                callback && callback(result);
            }
            return client;
        },
        error: function(callback){
            if (MockRedis.clientException){
                MockRedis.events.error && MockRedis.events.error(MockRedis.clientException);
                callback && callback(MockRedis.clientException);
            }
            return client;
        },
        errorHint: function(label) { return client.error(function(error){ logger.error('error(' + label + '): ' + error); })},
        thenHint: function(label,callback) { return client.then(callback).errorHint(label); },
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
            var result = MockRedis.lookup.get[key];
            MockRedis.results = result === null ? null : result || '0';
            return client;
        },
        hdel: function(args){
            MockRedis.calls.push({hdel: args});
            MockRedis.results = null;
            return client;
        },
        hgetall: function(key){
            MockRedis.calls.push({hgetall: key});
            MockRedis.results = MockRedis.lookup.hgetall[key] || null;
            return client;
        },
        hmset: function(key,values){
            var args = values ? [key,values] : key;
            MockRedis.calls.push({hmset: args});
            MockRedis.results = null;
            return client;
        },
        hset: function(key,subkey,value){
            MockRedis.calls.push({hset: [key,subkey,value]});
            MockRedis.results = null;
            return client;
        },
        hsetnx: function(key,subkey,value){
            MockRedis.calls.push({hsetnx: [key,subkey,value]});
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
    module.exports.mocksocketio.lastInstance = null;
    mockSocketIO.httpServer = null;
    mockSocketIO.eventHandlers = {};
    mockSocketIO.sockets = [];
    mockSocketIO.useCallback = null;
};

mockSocketIO.newMockSocket = function(){
    var mockSocket = {
        socketID: mockSocketIO.sockets.length,
        eventHandlers: {},
        handshake: {session: {}}
    };
    mockSocket.on = function(event,callback){
        mockSocket.eventHandlers[event] = callback;
    };
    mockSocket.listeners = function(event){
        return mockSocket.eventHandlers[event] || [];
    },
    mockSocket.emit = function(event,data){
        var args = {socket: mockSocket.socketID};
        args[event] = data;
        mockSocketIO.calls.push({emit: args});
    };
    mockSocketIO.sockets.push(mockSocket);
    return mockSocket;
};

mockSocketIO.use = function(callback){
    mockSocketIO.useCallback = callback;
};

module.exports.mocksocketio = function (httpServer){
    mockSocketIO.reset();
    mockSocketIO.httpServer = httpServer;
    return module.exports.mocksocketio.lastInstance = mockSocketIO;
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

// HTTP -----------------------

var MockHTTP = {
    reset: function(){
        MockHTTP.port = null;
        MockHTTP.app = null;
        MockHTTP.addressResult = null;
        MockHTTP.events = {};
        MockHTTP.headers = {};
        MockHTTP.statusCode = 200;
        MockHTTP.statusMessage = null;
        MockHTTP.requestError = null;
        MockHTTP.lastOptions = null;
        MockHTTP.written = [];
    },
    createServer: function(app){ MockHTTP.app = app; return MockHTTP; },
    listen: function(port){ MockHTTP.port = port; },
    address: function(){ return MockHTTP.addressResult || {addr: 'host',port: MockHTTP.port || 1234}; },
    on: function(event,callback){ MockHTTP.events[event] = callback; return MockHTTP; },
    request: function(options,callback){ MockHTTP.lastOptions = options; MockHTTP.callback = callback; return MockHTTP; },
    write: function(data) { MockHTTP.written.push(data); },
    send: function(data) { MockHTTP.written.push({send: data}); },
    end: function() {
        if (MockHTTP.requestError) {
            var error = new Error(MockHTTP.requestError);
            MockHTTP.written.push(error);
            MockHTTP.events.error && MockHTTP.events.error(error);
        } else {
            MockHTTP.written.push(null);
            MockHTTP.callback && MockHTTP.callback({statusCode: MockHTTP.statusCode,statusMessage: MockHTTP.statusMessage,headers: MockHTTP.headers,on: MockHTTP.on});
            MockHTTP.callback = null;
        }
    }
};

module.exports.mockhttp = MockHTTP;

// HTTPS -----------------------

var MockHTTPS = {
    reset: function(){
        MockHTTPS.port = null;
        MockHTTPS.app = null;
        MockHTTPS.addressResult = null;
        MockHTTPS.events = {};
        MockHTTPS.headers = {};
        MockHTTPS.statusCode = 200;
        MockHTTPS.statusMessage = null;
        MockHTTPS.requestError = null;
        MockHTTPS.lastOptions = null;
        MockHTTPS.written = [];
    },
    createServer: function(app){ MockHTTPS.app = app; return MockHTTPS; },
    listen: function(port){ MockHTTPS.port = port; },
    address: function(){ return MockHTTPS.addressResult || {addr: 'host',port: MockHTTPS.port || 1234}; },
    on: function(event,callback){ MockHTTPS.events[event] = callback; return MockHTTPS; },
    request: function(options,callback){ MockHTTPS.lastOptions = options; MockHTTPS.callback = callback; return MockHTTPS; },
    write: function(data) { MockHTTPS.written.push(data); },
    send: function(data) { MockHTTPS.written.push({send: data}); },
    end: function() {
        if (MockHTTPS.requestError) {
            var error = new Error(MockHTTPS.requestError);
            MockHTTPS.written.push(error);
            MockHTTPS.events.error && MockHTTPS.events.error(error);
        } else {
            MockHTTPS.written.push(null);
            MockHTTPS.callback && MockHTTPS.callback({statusCode: MockHTTPS.statusCode,statusMessage: MockHTTPS.statusMessage,headers: MockHTTPS.headers,on: MockHTTPS.on});
            MockHTTPS.callback = null;
        }
    }
};

module.exports.mockhttps = MockHTTPS;

// SESSION -----------------------

module.exports.setTestSession = function(request,data){
    var sessionID = 'iZ_tCPQOgfroEZJFbw_6y1gra9wOtI9G';
    var sessionStore = require(process.cwd() + '/lib/session').sessionOptions.store;
    sessionStore.sessions[sessionID] = '{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"proxy":' + JSON.stringify(data) + '}';
    request.cookies = 'connect.sid=s%3AiZ_tCPQOgfroEZJFbw_6y1gra9wOtI9G.SaGd1XQiRRpbQCNzdxpLeL5B6qLJoXZy338zallKwfc; Path=/; HttpOnly';
};

// OS -----------------------

var MockOS = {
    reset: function(){
        MockOS.interfaces = {};
    },
    networkInterfaces: function(){ return MockOS.interfaces; }
};

module.exports.mockos = MockOS;

process.env.testing = true;

