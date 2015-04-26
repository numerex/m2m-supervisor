var test = require('../test');
var UdpListener = require(process.cwd() + '/lib/udp-listener');

describe('UdpListener',function() {
    var mockdgram = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.warnOnUnregistered(false);
    });

    afterEach(function () {
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.pp.snapshot().should.eql([]);
    });

    it('minimal setup is performed without port or onmessage function that logs an error when receiving data',function(){
        var listener = new UdpListener('test');
        [listener.client.socketType,listener.client.port].should.eql(['udp4',undefined]);
        listener.client.events.message('test',{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[test      ] incoming - size: 4 from: host:1234',
            '[test      ] message error: TypeError: undefined is not a function'
        ]);
    });

    it('minimal setup is performed with a port and onmessage function should be called',function(){
        var called = false;
        var listener = new UdpListener('test',5678,function(buffer){
            called = true;
        });
        [listener.client.socketType,listener.client.port].should.eql(['udp4',5678]);
        listener.client.events.message('test',{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql(['[test      ] incoming - size: 4 from: host:1234']);
        called.should.be.ok;
    });

    it('should log listening',function(){
        var listener = new UdpListener('test');
        listener.client.events.listening();
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql(['[test      ] listening on localhost:1000']);
    });

    it('should log connection closed',function(){
        var listener = new UdpListener('test');
        listener.close();
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql(['[test      ] connection closed']);
    });

    it('should log an error',function(){
        var listener = new UdpListener('test');
        listener.client.events.error('test error');
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql(['[test      ] error event: test error']);
    });

    it('should successfully send a message',function(){
        var listener = new UdpListener('test');
        listener.send('message','remote',2000);
        mockdgram.deliveries.should.eql([[ 'message',0,7,2000,'remote' ]]);
        test.pp.snapshot().should.eql(['[test      ] outgoing - size: 7 from: remote:2000']);
    });


    it('should log an error when sending a message',function(){
        var listener = new UdpListener('test');
        listener.send(null,'remote',2000);
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql(["[test      ] send error: TypeError: Cannot read property 'length' of null"]);
    });

});