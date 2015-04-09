var _ = require('lodash');
var m2m = require('m2m-ota-javascript');

var test = require('../test');
var M2mProxy = require(process.cwd() + '/lib/m2m-proxy');

var defaults = Object.freeze(require(process.cwd() + '/config/m2m-defaults'));

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
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('dgram');
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
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
            {lpush: ["command:queue",'{"majorVersion":1,"minorVersion":0,"messageType":204,"eventCode":0,"sequenceNumber":0,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}']}
        ]);
    });

    it('should record route an MT ACK to the command:queue',function(){
        var proxy = new M2mProxy(redis, _.defaults({imei: '123456789012345'},defaults));
        var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 10}).pushString(0,proxy.gateway.imei).toWire();
        proxy.outside.client.events.message(buffer,{address: 'host',port: 1234});
        mockdgram.deliveries.should.eql([]);
        test.pp.snapshot().should.eql([
            '[outside   ] incoming - size: 34 from: host:1234',
            '[proxy     ] receive ack'
        ]);
        test.mockredis.snapshot().should.eql([
            {lpush: ["ack:queue",10]}
        ]);
    });

    it('should relay a private message',function(){
        var events = [];
        var proxy = new M2mProxy(redis,defaults,function(event){
            events.push(event);
        });

        test.timekeeper.freeze(1428594562570);
        proxy.private.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['ready','private']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'172.29.12.253']]);
        test.pp.snapshot().should.eql([
            '[private   ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: 172.29.12.253:3011'
        ]);
        test.mockredis.snapshot().should.eql([
            {mset: ["transmit:last-timestamp",1428594562570,"transmit:last-private-timestamp",1428594562570]}
        ]);
        test.timekeeper.reset();
    });

    it('should relay a public message',function(){
        var events = [];
        var proxy = new M2mProxy(redis,defaults,function(event){
            events.push(event);
        });

        test.timekeeper.freeze(1428594562570);
        proxy.public.client.events.message('test',{address: 'localhost',port: 1234});
        events.should.eql(['ready','public']);
        mockdgram.deliveries.should.eql([['test',0,4,3011,'192.119.183.253']]);
        test.pp.snapshot().should.eql([
            '[public    ] incoming - size: 4 from: localhost:1234',
            '[outside   ] outgoing - size: 4 from: 192.119.183.253:3011'
        ]);
        test.mockredis.snapshot().should.eql([
            {set: ["transmit:last-timestamp",1428594562570]}
        ]);
        test.timekeeper.reset();
    });

});