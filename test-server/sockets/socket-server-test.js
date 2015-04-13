var test = require('../test');
var SocketServer = require(process.cwd() + '/sockets/socket-server');

describe('SocketServer',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.warnOnUnregistered(false);
    });

    afterEach(function () {
        test.mockery.deregisterMock('socket.io');
        test.pp.snapshot().should.eql([]);
    });

    it('should be successfully started',function(){
        var socketServer = new SocketServer();
        socketServer.started().should.not.be.ok;
        socketServer.start('test http').should.equal(socketServer);
        socketServer.started().should.be.ok;
        test.mocksocketio.model.httpServer.should.eql('test http');
        test.mocksocketio.snapshot().should.eql({calls: [],events: ['connection'],sockets: []});
        test.pp.snapshot().should.eql([]);
    });

});
