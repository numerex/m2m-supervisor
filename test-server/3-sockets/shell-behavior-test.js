var test = require('../test');
var SocketServer = require(process.cwd() + '/sockets/socket-server');
var ShellBehavior = require(process.cwd() + '/sockets/shell-behavior');

describe('ShellBehavior',function() {

    var socketServer = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockery.warnOnUnregistered(false);
        test.mockshelljs.reset();
        test.mocksocketio.reset();
        socketServer = new SocketServer();
        socketServer.start('test http');
    });

    afterEach(function () {
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('socket.io');
        test.pp.snapshot().should.eql([]);
        test.mockshelljs.snapshot().should.eql([]);
        test.mocksocketio.snapshot().calls.should.eql([]);
    });

    it('should properly self-register then connect two sockets, closing one and disconnecting the other',function(){
        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket1 = socketServer.ioServer.newMockSocket();
        var mockSocket2 = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket1);
        socketServer.ioServer.eventHandlers.connection(mockSocket2);
        mockSocket1.eventHandlers.behavior('shell');
        mockSocket2.eventHandlers.behavior('shell');
        mockSocket1.eventHandlers.disconnect();
        mockSocket2.eventHandlers.close();

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] connection(2)',
            '[socket    ] behavior(1): shell',
            '[socket    ] behavior(2): shell',
            '[socket    ] disconnect(1)',
            '[shell     ] disconnect(1)',
            '[socket    ] close(2)',
            '[shell     ] close(2)'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','input','kill']},
                {id: 1,events: ['behavior','disconnect','close','input','kill']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 1,identified: {id: 2}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 1,behavior: {id: 2,result: true}}}]
        });
    });

    it('should log an error for an invalid command',function(){
        test.mockshelljs.lookup['test command'] = [1,'test error'];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');

        mockSocket.eventHandlers.input(null);

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): null',
            "[shell     ] command error: TypeError: Cannot read property 'command' of null"
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,output: {id: 1,stderr: "TypeError: Cannot read property 'command' of null"}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should allow for a command to be submitted and return an error',function(){
        test.mockshelljs.lookup['test command'] = [1,'test error'];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');

        test.mockshelljs.processes.length.should.equal(0);
        mockSocket.eventHandlers.input({command: 'test command'});
        test.mockshelljs.processes.length.should.equal(1);

        var process = test.mockshelljs.processes[0];
        process.snapshot().should.eql({id: 0,events: ['close','exit','error'],stdin: [],stdout: ['data'],stderr: ['data']});

        process.stderr.eventHandlers.data('test error');
        process.eventHandlers.exit(127,null);
        process.eventHandlers.close(127,null);

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): {"command":"test command"}',
            '[shell     ] exit(1): 127,null'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'test error'}}},
                {emit: {socket: 0,exit: {id: 1,code: 127,signal: null}}},
                {emit: {socket: 0,close: {id: 1,code: 127,signal: null}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should indicate that no active command exists',function(){
        test.mockshelljs.lookup['test command'] = [0,null];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');
        mockSocket.eventHandlers.kill({signal: 'SIGTERM'});

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] kill(1)-undefined-done: {"signal":"SIGTERM"}'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'No active command'}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should allow a command to be submitted and then killed by an incoming event',function(){
        test.mockshelljs.lookup['test command'] = [0,null];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');
        mockSocket.eventHandlers.input({command: 'test command'});

        var process = test.mockshelljs.processes[0];
        process.stdout.eventHandlers.data('test output');

        mockSocket.eventHandlers.kill({signal: 'SIGTERM'});
        mockSocket.eventHandlers.kill(null);

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): {"command":"test command"}',
            '[shell     ] kill(1)-test command-active: {"signal":"SIGTERM"}',
            '[shell     ] exit(1): null,SIGTERM',
            '[shell     ] kill(1)-test command-done: null'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,stdout: 'test output'}}},
                {emit: {socket: 0,exit: {id: 1,code: null,signal: 'SIGTERM'}}},
                {emit: {socket: 0,close: {id: 1,code: null,signal: 'SIGTERM'}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'No active command'}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should allow a command to be submitted and then killed by socket close',function(){
        test.mockshelljs.lookup['test command'] = [0,null];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');
        mockSocket.eventHandlers.input({command: 'test command'});

        var process = test.mockshelljs.processes[0];
        process.stdout.eventHandlers.data('test output');

        mockSocket.eventHandlers.close();

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): {"command":"test command"}',
            '[socket    ] close(1)',
            '[shell     ] close(1)',
            '[shell     ] exit(1): null,SIGTERM'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,stdout: 'test output'}}},
                {emit: {socket: 0,exit: {id: 1,code: null,signal: 'SIGTERM'}}},
                {emit: {socket: 0,close: {id: 1,code: null,signal: 'SIGTERM'}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should allow a command to be submitted and then killed by socket disconnect',function(){ // TODO this behavior may change in the future
        test.mockshelljs.lookup['test command'] = [0,null];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');
        mockSocket.eventHandlers.input({command: 'test command'});

        var process = test.mockshelljs.processes[0];
        process.stdout.eventHandlers.data('test output');

        mockSocket.eventHandlers.disconnect();

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): {"command":"test command"}',
            '[socket    ] disconnect(1)',
            '[shell     ] disconnect(1)',
            '[shell     ] exit(1): null,SIGTERM'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,stdout: 'test output'}}},
                {emit: {socket: 0,exit: {id: 1,code: null,signal: 'SIGTERM'}}},
                {emit: {socket: 0,close: {id: 1,code: null,signal: 'SIGTERM'}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should allow a command to be submitted then trap and error and warn if another is requested before the current is finished',function(){
        test.mockshelljs.lookup['test command'] = [0,null];

        var shellBehavior = new ShellBehavior().registerSelf(socketServer);

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        mockSocket.eventHandlers.behavior('shell');
        mockSocket.eventHandlers.input({command: 'test command'});

        var process = test.mockshelljs.processes[0];
        process.eventHandlers.error('test error');

        mockSocket.eventHandlers.input({command: 'test command'});

        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: shell',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): shell',
            '[shell     ] input(1): {"command":"test command"}',
            '[shell     ] error(1): test error',
            '[shell     ] input(1): {"command":"test command"}',
            '[shell     ] ignore command on 1 - another already active'
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','input','kill']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,started: {id: 1,command: 'test command'}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'test error'}}},
                {emit: {socket: 0,output: {id: 1,stderr: 'A command is already active: test command'}}}
            ]
        });
        test.mockshelljs.snapshot(); // clear snapshot
    });

});
