var test = require('../test');
var UdpListener = require(process.cwd() + '/lib/udp-listener')

describe('UdpListener',function() {
    var mockdgram = null;

    beforeEach(function () {
        test.mockery.enable();
        mockdgram = new test.mockdgram();
        test.mockery.registerMock('dgram',mockdgram);
        test.mockery.warnOnUnregistered(false);
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
    });

    it('minimal setup is performed without port or onmessage function that logs an error when receiving data',function(){
        var listener = new UdpListener('test');
        [mockdgram.socketType,mockdgram.port].should.eql(['udp4',undefined]);
        mockdgram.events.message('test',{address: 'host',port: 1234});
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
        [mockdgram.socketType,mockdgram.port].should.eql(['udp4',5678]);
        mockdgram.events.message('test',{address: 'host',port: 1234});
        test.pp.snapshot().should.eql(['[test      ] incoming - size: 4 from: host:1234']);
        called.should.be.ok;
    });

    it('should log listening',function(){
        var listener = new UdpListener('test');
        mockdgram.events.listening();
        test.pp.snapshot().should.eql(['[test      ] listening on localhost:1000']);
    });

    it('should log connection closed',function(){
        var listener = new UdpListener('test');
        mockdgram.events.close();
        test.pp.snapshot().should.eql(['[test      ] connection closed']);
    });

    it('should log an error',function(){
        var listener = new UdpListener('test');
        mockdgram.events.error('test error');
        test.pp.snapshot().should.eql(['[test      ] error event: test error']);
    });

    it('should successfully send a message',function(){
        var listener = new UdpListener('test');
        listener.send('message','remote',2000);
        test.pp.snapshot().should.eql(['[test      ] outgoing - size: 7 from: remote:2000']);
    });


    it('should log an error when sending a message',function(){
        var listener = new UdpListener('test');
        listener.send(null,'remote',2000);
        test.pp.snapshot().should.eql(["[test      ] send error: TypeError: Cannot read property 'length' of null"]);
    });

});