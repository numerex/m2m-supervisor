var _ = require('lodash');
var m2m = require('m2m-ota-javascript');

var test = require('../test');
var GatewayProxy = require(process.cwd() + '/services/gateway-proxy');

var defaults = {
    primary: 'public',
    privateURL: 'udp:private-host:3011',
    privateRelay: 4000,
    publicURL: 'udp:public-host',
    publicRelay: 4001
};

describe('GatewayProxy',function() {

    var redis = null;
    var mockdgram = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis',test.mockredis);
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.registerMock('https',test.mockhttps);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        test.mockhttps.reset();
        redis = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('https');
        test.mockery.deregisterMock('dgram');
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize on start',function(){
        var proxy = new GatewayProxy().start(defaults,redis);
        proxy.config.should.be.eql(defaults);
        [proxy.outsideListener.client.port,proxy.privateListener.client.port,proxy.publicListener.client.port].should.eql([undefined,4000,4001]);
        proxy.stop();
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect an invalid gateway URL',function(){
        var proxy = new GatewayProxy().start(_.defaults({publicURL: 'xyz:123'},defaults),redis);
        proxy.stop();
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[proxy     ] invalid protocol: xyz:',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should record an invalid CRC on message arrival',function(){
        var proxy = new GatewayProxy().start(defaults,redis);
        proxy.outsideListener.client.events.message('test',{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] incoming - size: 4 from: host:1234',
            '[proxy     ] enqueue error: CRC found: t - CRC expected: 0',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should log an error when an unexpected message type arrives',function(){
        var proxy = new GatewayProxy().start(_.defaults({imei: '123456789012345'},defaults),redis);
        var buffer = new m2m.Message({messageType: -1,timestamp: 0}).pushString(0,proxy.config.imei).toWire();
        proxy.outsideListener.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] unexpected message type: 255',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should record route an MT EVENT to the command:queue',function(){
        test.timekeeper.freeze(1000000000000);
        var proxy = new GatewayProxy().start(_.defaults({imei: '123456789012345'},defaults),redis);
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_EVENT,timestamp: 0}).pushString(0,proxy.config.imei).toWire();
        proxy.outsideListener.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([[new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_ACK,timestamp: 1000000000000}).pushString(0,proxy.config.imei).toWire(),0,34,3011,'public-host']]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] enqueue command',
            '[outside   ] outgoing - size: 34 from: public-host:3011',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]},
            {lpush: ['m2m-command:queue','{"majorVersion":1,"minorVersion":0,"messageType":204,"eventCode":0,"sequenceNumber":0,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}']}
        ]);
        test.timekeeper.reset();
    });

    it('should record route an MT ACK to the command:queue if no matching ignoreAckHint',function(){
        var proxy = new GatewayProxy().start(_.defaults({imei: '123456789012345'},defaults),redis);
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 10}).pushString(0,proxy.config.imei).toWire();
        proxy.outsideListener.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] relay ack: 10',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {lpush: ['m2m-ack:queue',10]}
        ]);
    });

    it('should record route an MT ACK to the command:queue if matching ignoreAckHint',function(){
        var proxy = new GatewayProxy().start(_.defaults({imei: '123456789012345'},defaults),redis);
        proxy.ignoreAckHint = 10;
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 10}).pushString(0,proxy.config.imei).toWire();
        proxy.outsideListener.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] ignore ack: 10',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should relay a private message',function(){
        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(defaults,redis);

        test.timekeeper.freeze(1000000000000);
        proxy.privateListener.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['private']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'private-host']]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[private   ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: private-host:3011',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {mset: ['m2m-transmit:last-timestamp',1000000000000,'m2m-transmit:last-private-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

    it('should relay a public message',function(){
        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(defaults,redis);

        test.timekeeper.freeze(1000000000000);
        proxy.publicListener.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['public']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'public-host']]);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[public    ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: public-host:3011',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

    it('should send a public and then a private message using sendPrimary',function(){
        test.timekeeper.freeze(1000000000000);

        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(defaults,redis);

        proxy.sendPrimary('test',1);
        proxy.config.primary = 'private';
        proxy.sendPrimary('test',2);

        events.should.eql(['public','private']);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[outside   ] outgoing - size: 4 from: public-host:3011',
            '[outside   ] outgoing - size: 4 from: private-host:3011',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]},
            {mset: ['m2m-transmit:last-timestamp',1000000000000,'m2m-transmit:last-private-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

    it('should relay non-m2m messages over HTTPS that the gateway accepts',function(){
        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(_.defaults({publicURL: 'https://test'},defaults),redis);

        test.timekeeper.freeze(1000000000000);
        proxy.publicListener.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['public']);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[public    ] incoming - size: 4 from: localhost:1234',
            '[proxy     ] outgoing http: dGVzdA==',
            '[proxy     ] sequence number failure: CRC found: t - CRC expected: 0',
            '[proxy     ] relay ack: 0',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]},
            {lpush: ['m2m-ack:queue',0]}
        ]);
        test.timekeeper.reset();
    });

    it('should relay m2m messages over HTTPS that the gateway accepts',function(){
        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(_.defaults({publicURL: 'https://test'},defaults),redis);

        test.timekeeper.freeze(1000000000000);
        var message = new m2m.Message({messageType: m2m.Common.MOBILE_ORIGINATED_EVENT,sequenceNumber: 1});
        proxy.publicListener.client.events.message(message.toWire(),{address: 'localhost',port: 1234});
        events.should.eql(['public']);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[public    ] incoming - size: 15 from: localhost:1234',
            '[proxy     ] outgoing http: qhAAAAEAAADo1KUQAABG',
            '[proxy     ] relay ack: 1',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]},
            {lpush: ['m2m-ack:queue',1]}
        ]);
        test.timekeeper.reset();
    });

    it('should detect HTTPS failures',function(){
        test.mockhttps.statusCode = 500;

        var events = [];
        var proxy = new GatewayProxy()
            .on('send',function(type){ events.push(type); })
            .start(_.defaults({publicURL: 'https://test'},defaults),redis);

        test.timekeeper.freeze(1000000000000);
        proxy.publicListener.client.events.message('test',{address: 'localhost',port: 1234});
        test.mockhttps.events.error('test error');
        events.should.eql(['public']);
        proxy.stop();
        test.pp.snapshot().should.eql([
            '[proxy     ] start watching',
            '[public    ] incoming - size: 4 from: localhost:1234',
            '[proxy     ] outgoing http: dGVzdA==',
            '[proxy     ] http error status: 500',
            '[proxy     ] https error: test error',
            '[proxy     ] stop watching',
            '[private   ] connection closed',
            '[public    ] connection closed',
            '[outside   ] connection closed'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

});