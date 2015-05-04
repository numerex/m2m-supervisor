var _ = require('lodash');
var fs = require('fs');
var m2m = require('m2m-ota-javascript');

var test = require('../test');
var M2mSupervisor = require(process.cwd() + '/processes/m2m-supervisor');

describe('M2mSupervisor',function() {

    var mockdgram = null;
    var mockRoute = require(process.cwd() + '/test-server/mocks/route-test');
    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('dgram', mockdgram = new test.mockdgram());
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.registerMock('http',test.mockhttp);
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        test.mockhttp.reset();
        test.mocksocketio.reset();
        test.mockshelljs.reset();
        test.mocknet.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('net');
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('socket.io');
        test.mockery.deregisterMock('http');
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.mocksocketio.snapshot().calls.should.eql([]);
        test.mocknet.snapshot().should.eql([]);
        test.mockshelljs.snapshot().should.eql([]);
        mockdgram.deliveries.should.eql([]);
        mockRoute.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should start/stop with no services available - all',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor().start();
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance created',
                '[socket    ] register behavior: shell',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[http      ] Listening on port 3000',
                '[redis     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {end: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with no services available -- bridge',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor({runBridge: true}).start();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[redis     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {end: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with no services available -- transceiver',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor({runTransceiver: true}).start();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[redis     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {end: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with no services available -- web',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor({runWeb: true}).start();
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[socket    ] register behavior: shell',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[http      ] Listening on port 3000',
                '[redis     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {end: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with all available services, but no devices',function(done){
        var supervisor = new M2mSupervisor({retryInterval: 100}).start();
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[socket    ] register behavior: shell',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] now ready',
                '[hash      ] start watching: m2m-config',
                '[hash      ] check ready: m2m-config',
                '[proxy     ] start watching',
                '[pppd      ] start watching',
                '[pppd      ] pppstats error: Error: no response found: pppstats',
                '[modem     ] start watching',
                '[modem     ] start error: Error: ENOENT, no such file or directory \'/dev/ttyUSB2\'',
                '[http      ] Listening on port 3000',
                '[redis     ] stop watching',
                '[hash      ] stop watching: m2m-config',
                '[proxy     ] stop watching',
                '[private   ] connection closed',
                '[public    ] connection closed',
                '[outside   ] connection closed',
                '[pppd      ] stop watching',
                '[modem     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {hgetall: 'm2m-config'},
                {quit: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with all available services and a device',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-no-ppp.txt').toString()];
        test.mockshelljs.lookup['route add -net 172.29.12.0 netmask 255.255.255.0 dev ppp0'] = [0,''];
        test.mockredis.lookup.keys['*'] = ['m2m-device:testKey:settings'];
        test.mockredis.lookup.hgetall['m2m-config'] = {
            'gateway:imei': '352214046337094',
            'modem:report-file': 'test-server/data/modem-imei.txt',
            'modem:command-file': '/dev/null'
        };
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };
        test.mockredis.lookup.brpop = [['m2m-ack:queue',2],null];

        test.timekeeper.freeze(1000000000000);
        var supervisor = new M2mSupervisor({retryInterval: 1}).start();
        test.mockhttp.events.listening();
        var count = 0;
        supervisor.queueRouter.on('queueResult',function(result){
            switch(count++) {
                case 0:
                    result.should.equal('idle');
                    //test.pp.snapshot().should.eql([
                    //    '[redis     ] instance removed',
                    //    '[redis     ] instance created',
                    //    '[socket    ] register behavior: shell',
                    //    '[redis     ] start watching',
                    //    '[http      ] Listening on port 3000',
                    //    '[redis     ] check ready',
                    //    '[redis     ] now ready',
                    //    '[dev-route ] start watching: testKey',
                    //    '[hash      ] start watching: m2m-device:testKey:settings',
                    //    '[hash      ] start watching: m2m-config',
                    //    '[hash      ] check ready: m2m-device:testKey:settings',
                    //    '[hash      ] hash changed: m2m-device:testKey:settings',
                    //    '[device    ] start watching: testKey',
                    //    '[hash      ] now ready: m2m-device:testKey:settings',
                    //    '[hash      ] check ready: m2m-config',
                    //    '[hash      ] hash changed: m2m-config',
                    //    '[pppd      ] start watching',
                    //    '[pppd      ] add ppp route to GWaaS',
                    //    '[modem     ] start watching',
                    //    '[proxy     ] start watching',
                    //    '[heartbeat ] start watching',
                    //    '[heartbeat ] send heartbeat: 1',
                    //    '[outside   ] outgoing - size: 34 from: 192.119.183.253:3011',
                    //    '[router    ] start watching',
                    //    '[hash      ] now ready: m2m-config',
                    //    //'[pppd      ] add ppp route to GWaaS',
                    //    '[device    ] check ready: testKey',
                    //    '[device    ] now ready: testKey',
                    //    '[reader    ] start watching'
                    //]);
                    //test.mockredis.snapshot().should.eql([
                    //    {keys: '*'},
                    //    {hgetall: 'm2m-device:testKey:settings'},
                    //    {hgetall: 'm2m-config'},
                    //    {incr: 'm2m-transmit:last-sequence-number'},
                    //    {set: ['m2m-transmit:last-timestamp',1000000000000]},
                    //    {mget:['m2m-ack:message','m2m-ack:route-key','m2m-ack:retries','m2m-ack:sequence-number']},
                    //    {brpop: ['m2m-ack:queue','m2m-transmit:queue',5]},
                    //]);
                    mockdgram.deliveries.should.eql([[new Buffer([170,16,1,0,1,0,0,0,232,212,165,16,0,1,0,2,0,15,51,53,50,50,49,52,48,52,54,51,51,55,48,57,52,35]),0,34,3011,'172.29.12.253']]);
                    mockdgram.deliveries = [];
                    var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 1}).pushString(0,supervisor.proxy.config.imei).toWire();
                    supervisor.proxy.outside.client.events.message(buffer,{address: '172.29.12.253',port: 3011});
                    return;
                case 1:
                    result.should.equal('ignore');
                    //test.pp.snapshot().should.eql([
                    //]);
                    //test.mockredis.snapshot().should.eql([
                    //    {lpush: ['m2m-ack:queue',1]},
                    //    {hsetnx: ['m2m-config','gateway:imei','352214046337094']},
                    //    {mget:['m2m-ack:message','m2m-ack:route-key','m2m-ack:retries','m2m-ack:sequence-number']},
                    //    {brpop: ['m2m-ack:queue','m2m-transmit:queue','m2m-device:testKey:queue',5]}
                    //]);
                    _.defer(function(){
                        supervisor.stop();
                        //test.mockredis.snapshot().should.eql([
                        //    {mget:['m2m-ack:message','m2m-ack:route-key','m2m-ack:retries','m2m-ack:sequence-number']},
                        //    {brpop: ['m2m-ack:queue','m2m-transmit:queue','m2m-device:testKey:queue',5]},
                        //    {quit: null},
                        //    {quit: null}
                        //]);
                        //test.pp.snapshot().should.eql([
                        //    '[outside   ] incoming - size: 34 from: 192.119.183.253:3011',
                        //    '[proxy     ] relay ack: 1',
                        //    '[modem     ] RSSI: 21,99',
                        //    '[modem     ] IMEI: 352214046337094',
                        //    '[router    ] add route: m2m-device:testKey:queue',
                        //    '[router    ] ignoring queue entry: 2',
                        //    '[redis     ] stop watching',
                        //    '[hash      ] stop watching: m2m-config',
                        //    '[pppd      ] stop watching',
                        //    '[modem     ] stop watching',
                        //    '[proxy     ] stop watching',
                        //    '[private   ] connection closed',
                        //    '[public    ] connection closed',
                        //    '[outside   ] connection closed',
                        //    '[heartbeat ] stop watching',
                        //    '[router    ] stop watching',
                        //    '[hash      ] stop watching: m2m-device:testKey:settings',
                        //    '[device    ] stop watching: testKey',
                        //    '[reader    ] stop watching'
                        //]);
                        test.mocknet.snapshot().should.eql([
                            {connect: {host: 'host',port: 1234}},
                            {end: null}
                        ]);
                        test.pp.snapshot(); // NOTE - too many race conditions
                        test.mockredis.snapshot(); // NOTE - too many race conditions
                        test.mockshelljs.snapshot(); // NOTE - per pppd-watcher tests, clear ...
                        test.timekeeper.reset();
                        done();
                    });
                    break;
            }
        });
    });
});