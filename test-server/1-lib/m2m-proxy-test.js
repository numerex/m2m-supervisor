var _ = require('lodash');
var m2m = require('m2m-ota-javascript');

var test = require('../test');
var M2mProxy = require(process.cwd() + '/lib/m2m-proxy');

var defaults = {
    primary: 'public',
    privateHost: 'private-host',
    privatePort: 3011,
    privateRelay: 4000,
    publicHost: 'public-host',
    publicPort: 3011,
    publicRelay: 4001
};

describe('M2mProxy',function() {

    var redis = null;
    var mockdgram = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('redis',test.mockredis);
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('dgram');
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize',function(){
        var proxy = new M2mProxy(redis,defaults);
        proxy.gateway.should.be.eql(defaults);
        [proxy.outside.client.port,proxy.private.client.port,proxy.public.client.port].should.eql([undefined,4000,4001]);
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should record an invalid CRC on message arrival',function(){
        var proxy = new M2mProxy(redis,defaults);
        proxy.outside.client.events.message('test',{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 4 from: host:1234',
            '[proxy     ] enqueue error: Error: CRC found: t - CRC expected: 0'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should log an error when an unexpected message type arrives',function(){
        var proxy = new M2mProxy(redis, _.defaults({imei: '123456789012345'},defaults));
        var buffer = new m2m.Message({messageType: -1,timestamp: 0}).pushString(0,proxy.gateway.imei).toWire();
        proxy.outside.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] unexpected message type: 255'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should record route an MT EVENT to the command:queue',function(){
        var proxy = new M2mProxy(redis, _.defaults({imei: '123456789012345'},defaults));
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_EVENT,timestamp: 0}).pushString(0,proxy.gateway.imei).toWire();
        proxy.outside.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] enqueue command'
        ]);
        test.mockredis.snapshot().should.eql([
            {lpush: ['m2m-command:queue','{"majorVersion":1,"minorVersion":0,"messageType":204,"eventCode":0,"sequenceNumber":0,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}']}
        ]);
    });

    it('should record route an MT ACK to the command:queue if no matching ignoreAckHint',function(){
        var proxy = new M2mProxy(redis, _.defaults({imei: '123456789012345'},defaults));
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 10}).pushString(0,proxy.gateway.imei).toWire();
        proxy.outside.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] relay ack: 10'
        ]);
        test.mockredis.snapshot().should.eql([
            {lpush: ['m2m-ack:queue',10]}
        ]);
    });

    it('should record route an MT ACK to the command:queue if matching ignoreAckHint',function(){
        var proxy = new M2mProxy(redis, _.defaults({imei: '123456789012345'},defaults));
        proxy.ignoreAckHint = 10;
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 10}).pushString(0,proxy.gateway.imei).toWire();
        proxy.outside.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] ignore ack: 10'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should relay a private message',function(){
        var events = [];
        var proxy = new M2mProxy(redis,defaults);
        proxy.on('send',function(type){
            events.push(type);
        });

        test.timekeeper.freeze(1000000000000);
        proxy.private.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['private']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'private-host']]);
        test.pp.snapshot().should.eql([
            '[private   ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: private-host:3011'
        ]);
        test.mockredis.snapshot().should.eql([
            {mset: ['m2m-transmit:last-timestamp',1000000000000,'m2m-transmit:last-private-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

    it('should relay a public message',function(){
        var events = [];
        var proxy = new M2mProxy(redis,defaults);
        proxy.on('send',function(type){
            events.push(type);
        });

        test.timekeeper.freeze(1000000000000);
        proxy.public.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['public']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'public-host']]);
        test.pp.snapshot().should.eql([
            '[public    ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: public-host:3011'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

    it('should send a public and then a primvate message using sendPrimary',function(){
        test.timekeeper.freeze(1000000000000);

        var events = [];
        var proxy = new M2mProxy(redis,defaults);
        proxy.on('send',function(type){
            events.push(type);
        });

        proxy.sendPrimary('test',1);
        proxy.gateway.primary = 'private';
        proxy.sendPrimary('test',2);

        events.should.eql(['public','private']);
        test.pp.snapshot().should.eql([
            '[outside   ] outgoing - size: 4 from: public-host:3011',
            '[outside   ] outgoing - size: 4 from: private-host:3011'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ['m2m-transmit:last-timestamp',1000000000000]},
            {mset: ['m2m-transmit:last-timestamp',1000000000000,'m2m-transmit:last-private-timestamp',1000000000000]}
        ]);
        test.timekeeper.reset();
    });

});