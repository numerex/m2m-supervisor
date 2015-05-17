var test = require('../test');
var SocketServer = require(process.cwd() + '/sockets/socket-server');
var CommandBehavior = require(process.cwd() + '/sockets/command-behavior');
var RedisWatcher = require(process.cwd() + '/services/redis-watcher');
var M2mSupervisor = require(process.cwd() + '/processes/m2m-supervisor');

describe('CommandBehavior',function() {

    var socketServer = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mocksocketio.reset();
        test.mockredis.reset();
        socketServer = new SocketServer();
        socketServer.start('test http');
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('socket.io');
        test.pp.snapshot().should.eql([]);
        test.mocksocketio.snapshot().calls.should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    function ensureRedis(){
        if (!RedisWatcher.instance) new RedisWatcher();
        if (!RedisWatcher.instance.started()) RedisWatcher.instance.start();
    }

    function resetRedis(){
        if (RedisWatcher.instance && RedisWatcher.instance.started()) RedisWatcher.instance.stop();
        RedisWatcher.instance = null;
    }

    it('should properly self-register then connect two sockets, closing one and disconnecting the other',function(){
        var commandBehavior = new CommandBehavior().registerSelf(socketServer);

        var mockSocket1 = socketServer.io.newMockSocket();
        var mockSocket2 = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket1);
        socketServer.io.eventHandlers.connection(mockSocket2);
        mockSocket1.eventHandlers.behavior('command');
        mockSocket2.eventHandlers.behavior('command');
        mockSocket1.eventHandlers.disconnect();
        mockSocket2.eventHandlers.close();

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: command',
            '[socket    ] connection(1)',
            '[socket    ] connection(2)',
            '[socket    ] behavior(1): command',
            '[socket    ] behavior(2): command',
            '[socket    ] disconnect(1)',
            '[command   ] disconnect(1)',
            '[socket    ] close(2)',
            '[command   ] close(2)'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','device','command']},
                {id: 1,events: ['behavior','disconnect','close','device','command']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 1,identified: {id: 2}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 1,behavior: {id: 2,result: true}}}]
        });
    });

    it('should detect that redis is not ready',function(){
        var commandBehavior = new CommandBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('command');
        mockSocket.eventHandlers.device('test');
        mockSocket.eventHandlers.disconnect();
        mockSocket.eventHandlers.close();

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: command',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): command',
            '[socket    ] disconnect(1)',
            '[command   ] disconnect(1)',
            '[socket    ] close(1)',
            '[command   ] close(1)'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','device','command']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'Redis not ready'}}}
            ]
        });
    });

    it('should detect that a device is not ready',function(){
        M2mSupervisor.instance = {
            queueRouter: {
                started: function() { return true; },
                routes: {}
            }
        };

        var commandBehavior = new CommandBehavior().registerSelf(socketServer);

        ensureRedis();
        var mockSocket = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('command');
        mockSocket.eventHandlers.device('test');
        mockSocket.eventHandlers.command(null);
        mockSocket.eventHandlers.disconnect();
        mockSocket.eventHandlers.close();
        resetRedis();

        M2mSupervisor.instance = null;

        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {quit: null}
        ]);
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: command',
            '[redis     ] start watching',
            '[redis     ] check ready',
            '[redis     ] now ready',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): command',
            '[socket    ] disconnect(1)',
            '[command   ] disconnect(1)',
            '[socket    ] close(1)',
            '[command   ] close(1)',
            '[redis     ] stop watching'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','device','command']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'Device not ready: test'}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'Device not ready'}}}
            ]
        });
    });

    it('should register a device and return its profile',function(){
        test.mockredis.lookup.hgetall['m2m-device:test1:settings'] = {'command:profile': 'test-profile'};
        test.mockredis.lookup.brpop = [['m2m-device:test1:queue','{}'],['m2m-device:test1:queue','{"11":"OK","12":"error"}']];
        M2mSupervisor.instance = {
            queueRouter: {
                started: function() { return true; },
                routes: {'m2m-device:test1:queue': true,'m2m-device:test2:queue': true}
            }
        };

        var commandBehavior = new CommandBehavior().registerSelf(socketServer);

        ensureRedis();
        var mockSocket = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('command');
        mockSocket.eventHandlers.device('test1');
        mockSocket.eventHandlers.command({command: 'test command'});
        mockSocket.eventHandlers.device('test2');
        mockSocket.eventHandlers.command({command: 'test command'});
        mockSocket.eventHandlers.command({command: 'test command'});
        mockSocket.eventHandlers.disconnect();
        mockSocket.eventHandlers.close();
        resetRedis();

        M2mSupervisor.instance = null;

        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {del: 'm2m-web:1:queue'},
            {hgetall: 'm2m-device:test1:settings'},
            {lpush: ['m2m-device:test1:queue','{"command":"test command","responseID\":1,"destination":"m2m-web:1:queue"}']},
            {brpop: 'm2m-web:1:queue'},
            {del: 'm2m-web:1:queue'},
            {hgetall: 'm2m-device:test2:settings'},
            {lpush: ['m2m-device:test2:queue','{"command":"test command","responseID":1,"destination":"m2m-web:1:queue"}']},
            {brpop: 'm2m-web:1:queue'},
            {lpush: ['m2m-device:test2:queue','{"command":"test command","responseID":1,"destination":"m2m-web:1:queue"}']},
            {brpop: 'm2m-web:1:queue'},
            {del: 'm2m-web:1:queue'},
            {quit: null},
            {quit: null}
        ]);
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: command',
            '[redis     ] instance created',
            '[redis     ] start watching',
            '[redis     ] check ready',
            '[redis     ] now ready',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): command',
            '[command   ] device(1): "test1"',
            '[command   ] command(1): {"command":"test command"}',
            '[command   ] device(1): "test2"',
            '[command   ] command(1): {"command":"test command"}',
            '[command   ] command(1): {"command":"test command"}',
            '[socket    ] disconnect(1)',
            '[command   ] disconnect(1)',
            '[socket    ] close(1)',
            '[command   ] close(1)',
            '[redis     ] stop watching'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','device','command']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,output: {id: 1,stdin: 'Device ready: test1'}}},
                {emit: {socket: 0,note: {id: 1,profile: 'test-profile'}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,command: 'test command',stdout: 'OK',stderr: 'error'}}},
                {emit: {socket: 0,output: {id: 1,stdin: 'Device ready: test2'}}},
                {emit: {socket: 0,note: {id: 1,profile: null}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,command: 'test command',stdout: null,stderr: null}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,command: 'test command',stderr: 'timeout'}}}
            ]
        });
    });

});
