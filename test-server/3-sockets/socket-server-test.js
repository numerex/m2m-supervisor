var test = require('../test');
var SocketServer = require(process.cwd() + '/sockets/socket-server');

describe('SocketServer',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.warnOnUnregistered(false);
        test.mocksocketio.reset();
    });

    afterEach(function () {
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

        socketServer.registerBehavior('mock',{});

        var mockSocket = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket);
        test.mocksocketio.snapshot().should.eql({
            events: ['connection'],
            sockets: [{id: 0,events: ['behavior','disconnect','close']}],
            calls: [{emit: {socket: 0,identified: {id: 1}}}]
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
                {emit: {socket: 0,behavior: {id: 1,result: true}}},
                {emit: {socket: 0,behavior: {id: 1,result: false}}}
            ]
        });
        test.pp.snapshot().should.eql([
            '[socket    ] behavior(1): mock',
            '[socket    ] behavior(1): mock',
            '[socket    ] disconnect(1)',
            '[socket    ] close(1)'
        ]);

    });
    
    it('should successfully handle behaviors with full capabilities through its lifecycle',function(){
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

        var mockSocket = socketServer.io.newMockSocket();
        socketServer.io.eventHandlers.connection(mockSocket);
        
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
                {emit: {socket: 0,behavior: {id: 1,result: true}}}
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

    it('should detect an attempt to register the same named behavior more than once',function(){
        var socketServer = new SocketServer();
        socketServer.start('test http');
        socketServer.registerBehavior('mock',{});
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

});
