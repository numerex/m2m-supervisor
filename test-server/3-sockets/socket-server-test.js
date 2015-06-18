var test = require('../test');
var SocketServer = require(process.cwd() + '/sockets/socket-server');

describe('SocketServer',function() {

    var mockClients = [];

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.warnOnUnregistered(false);
        test.mockery.registerMock('socket.io-client',function (url,options){
            mockClients.push([url,options]);
            return test.mocksocketio.lastInstance.newMockSocket();
        });
        test.mocksocketio.reset();
        mockClients = [];
    });

    afterEach(function () {
        test.mockery.deregisterMock('socket.io-client');
        test.mockery.deregisterMock('socket.io');
        test.pp.snapshot().should.eql([]);
        test.mocksocketio.snapshot().calls.should.eql([]);
    });

    it('should be successfully started and a socket connected with a simple behavior applied but only once',function(){
        var socketServer = new SocketServer();
        socketServer.started().should.not.be.ok;
        socketServer.start('test http').should.equal(socketServer);
        socketServer.started().should.be.ok;
        test.mocksocketio.model.httpServer.should.eql('test http');
        test.mocksocketio.snapshot().should.eql({calls: [],events: ['connection'],sockets: []});

        socketServer.registerBehavior('mock',{eventHandlers: []});

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,ready: {id: 1}}}
            ]
        });
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: mock',
            '[socket    ] connection(1)'
        ]);

        mockSocket.eventHandlers.behavior('mock');
        mockSocket.eventHandlers.behavior('mock');
        mockSocket.eventHandlers.disconnect(null);
        mockSocket.eventHandlers.close(null);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close']}],
            calls: [
                {emit: {socket: 0,behavior: {id: 1,result: true,emissions: []}}},
                {emit: {socket: 0,behavior: {id: 1,result: false,emissions: []}}}
            ]
        });
        test.pp.snapshot().should.eql([
            '[socket    ] behavior(1): mock',
            '[socket    ] behavior(1): mock',
            '[socket    ] disconnect(1)',
            '[socket    ] close(1)'
        ]);

    });

    it('should detect an attempt to register the same named behavior more than once',function(){
        var socketServer = new SocketServer();
        socketServer.start('test http');
        socketServer.registerBehavior('mock',{eventHandlers: []});
        test.expect(function(){ socketServer.registerBehavior('mock',{}); }).to.throw('behavior already registered: mock');
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [],
            calls: []
        });
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: mock'
        ]);
    });

    it('should successfully handle behaviors with full capabilities through its lifecycle without a proxy',function(){
        var socketServer = new SocketServer();
        socketServer.start('test http');

        var behaviorCalls = [];
        socketServer.registerBehavior('mock',{
            eventHandlers: [{
                event: 'test',
                callback: function(socket,data){ behaviorCalls.push({test: {socket: socket && socket.clientID,data: data}}); }
            }],
            disconnectEvent: function(socket){ behaviorCalls.push({disconnect: socket && socket.clientID})},
            closeEvent: function(socket){ behaviorCalls.push({close: socket && socket.clientID})}
        });

        var mockSocket = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.eventHandlers.connection(mockSocket);

        mockSocket.eventHandlers.behavior('mock');
        mockSocket.eventHandlers.test('data');
        mockSocket.eventHandlers.disconnect();
        mockSocket.eventHandlers.close();
        behaviorCalls.should.eql([
            {test: {socket: 1,data: 'data'}},
            {disconnect: 1},
            {close: 1}
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close','test']}],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,ready: {id: 1}}},
                {emit: {socket: 0,behavior: {id: 1,result: true,emissions: []}}}
            ]
        });
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: mock',
            '[socket    ] connection(1)',
            '[socket    ] behavior(1): mock',
            '[socket    ] disconnect(1)',
            '[socket    ] close(1)'
        ]);
    });

    it('should successfully handle behaviors with full capabilities through its lifecycle with a proxy',function(){
        var socketServer = new SocketServer();
        socketServer.start('test http');

        var behaviorCalls = [];
        socketServer.registerBehavior('mock',{
            eventHandlers: [{
                event: 'test',
                callback: function(socket,data){ behaviorCalls.push({test: {socket: socket && socket.clientID,data: data}}); }
            }],
            emissions: ['test'],
            disconnectEvent: function(socket){ behaviorCalls.push({disconnect: socket && socket.clientID})},
            closeEvent: function(socket){ behaviorCalls.push({close: socket && socket.clientID})}
        });

        var mockSocket1 = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.useCallback(mockSocket1,function(){});
        mockSocket1.handshake.session.proxy = {hostname: 'test'};
        socketServer.ioServer.eventHandlers.connection(mockSocket1);

        mockSocket1.proxySocket.eventHandlers.connect({id: 10});
        mockSocket1.proxySocket.eventHandlers.identified({id: 10});

        var mockSocket2 = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.useCallback(mockSocket2,function(){});
        mockSocket2.handshake.session.proxy = {hostname: 'test'};
        socketServer.ioServer.eventHandlers.connection(mockSocket2);

        mockSocket1.eventHandlers.behavior('mock');
        mockSocket1.proxySocket.eventHandlers.behavior({id: 10,result: true,emissions: ['test']});
        mockSocket1.eventHandlers.test('data');
        mockSocket1.proxySocket.eventHandlers.test('result');
        mockSocket1.eventHandlers.disconnect();
        mockSocket1.eventHandlers.close();

        mockSocket2.eventHandlers.disconnect();
        mockSocket2.eventHandlers.close();

        mockSocket1.proxySocket.eventHandlers.connect({id: 10});

        var mockSocket3 = socketServer.ioServer.newMockSocket();
        socketServer.ioServer.useCallback(mockSocket3,function(){});
        mockSocket3.handshake.session.proxy = {hostname: 'test'};
        socketServer.ioServer.eventHandlers.connection(mockSocket3);
        mockSocket3.eventHandlers.behavior('mock');
        mockSocket3.eventHandlers.test('data');
        mockSocket3.proxySocket.eventHandlers.reconnect_attempt();
        mockSocket3.proxySocket.eventHandlers.reconnecting(1);
        mockSocket3.proxySocket.eventHandlers.reconnect(1);
        mockSocket3.proxySocket.eventHandlers.reconnect_failed();
        mockSocket3.proxySocket.eventHandlers.error(new Error('test error'));
        mockSocket3.proxySocket.eventHandlers.disconnect();
        mockSocket3.proxySocket.eventHandlers.close();
        mockSocket3.eventHandlers.disconnect();
        mockSocket3.eventHandlers.close();

        mockClients.should.eql([
            ['http://test:5000',{path: '/supervisor/socket'}]
        ]);

        behaviorCalls.should.eql([
            {disconnect: 1},
            {close: 1},
            {disconnect: 3},
            {close: 3}
        ]);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [
                {id: 0,events: ['behavior','disconnect','close','test']},
                {id: 1,events: ['connect','close','disconnect','error','reconnect','reconnect_attempt','reconnecting','reconnect_failed','identified','behavior','test']},
                {id: 2,events: ['behavior','disconnect','close']},
                {id: 3,events: ['behavior','disconnect','close','test']}
            ],
            calls: [
                {emit: {socket: 0,identified: {id: 1}}},
                {emit: {socket: 0,ready: {id: 1}}},
                {emit: {socket: 2,identified: {id: 2}}},
                {emit: {socket: 2,busy: {id: 2}}},
                {emit: {socket: 0,behavior: {id: 1,result: true,emissions: ['test']}}},
                {emit: {socket: 1,behavior: 'mock'}},
                {emit: {socket: 1,test: 'data'}},
                {emit: {socket: 0,test: 'result'}},
                {emit: {socket: 3,identified: {id: 3}}},
                {emit: {socket: 3,ready: {id: 3}}},
                {emit: {socket: 3,behavior: {id: 3,result: true,emissions: ['test']}}},
                {emit: {socket: 1,behavior: 'mock'}},
                {emit: {socket: 1,test: 'data'}}
            ]
        });
        test.pp.snapshot().should.eql([
            '[socket    ] register behavior: mock',
            '[socket    ] connection(1)',
            '[socket    ] proxy connect - relayed',
            '[socket    ] proxy identified: {"id":10}',
            '[socket    ] connection(2)',
            '[socket    ] behavior(1): mock',
            '[socket    ] proxy behavior: {"id":10,"result":true,"emissions":["test"]}',
            '[socket    ] proxy incoming event: test "data"',
            '[socket    ] proxy outgoing event: test "result"',
            '[socket    ] disconnect(1)',
            '[socket    ] close(1)',
            '[socket    ] disconnect(2)',
            '[socket    ] close(2)',
            '[socket    ] proxy connect - ignored',
            '[socket    ] connection(3)',
            '[socket    ] behavior(3): mock',
            '[socket    ] proxy incoming event: test "data"',
            '[socket    ] proxy reconnect_attempt',
            '[socket    ] proxy reconnecting: 1',
            '[socket    ] proxy reconnect: 1',
            '[socket    ] proxy reconnect_failed',
            '[socket    ] proxy error: test error',
            '[socket    ] proxy disconnect',
            '[socket    ] proxy close',
            '[socket    ] disconnect(3)',
            '[socket    ] close(3)'
        ]);
    });

});
