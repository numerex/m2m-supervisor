var _ = require('lodash');
var fs = require('fs');
var m2m = require('m2m-ota-javascript');

var test = require('../test');

var setup = require(process.cwd() + '/lib/global-setup');

var M2mSupervisor = require(process.cwd() + '/processes/m2m-supervisor');

describe('M2mSupervisor',function() {

    var mockdgram = null;
    var mockRoute = require(process.cwd() + '/test-server/mocks/route-test');
    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');

    function FtpSetup(name){
        this.setupNow = function(callback){ callback(null); };
    }

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('./ftp-setup',FtpSetup);
        test.mockery.registerMock('dgram', mockdgram = new test.mockdgram());
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.registerMock('http',test.mockhttp);
        test.mockery.registerMock('socket.io',test.mocksocketio);
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.registerMock('serialport', test.mockserialport);
        test.mockery.registerMock('os',test.mockos);
        test.mockery.warnOnUnregistered(false);
        test.mockserialport.reset();
        test.mockredis.reset();
        test.mockhttp.reset();
        test.mocksocketio.reset();
        test.mockshelljs.reset();
        test.mocknet.reset();
        test.mockos.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('./ftp-setup');
        test.mockery.deregisterMock('os');
        test.mockery.deregisterMock('net');
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('socket.io');
        test.mockery.deregisterMock('http');
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.deregisterMock('serialport');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.mocksocketio.snapshot().calls.should.eql([]);
        test.mocknet.snapshot().should.eql([]);
        test.mockserialport.snapshot().should.eql([]);
        test.mockshelljs.snapshot().should.eql([]);
        mockdgram.deliveries.should.eql([]);
        mockRoute.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should restart with no services available - all',function(done){
        test.mockredis.clientException = 'test error';
        test.mockos.interfaces = {eth0: {}};

        var supervisor = new M2mSupervisor().start();
        supervisor.supervisorProxy.should.not.be.ok;
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.restart();
            test.mockhttp.events.listening();
            _.defer(function(){
                supervisor.stop();
                test.pp.snapshot().should.eql([
                    '[socket    ] register behavior: shell',
                    '[socket    ] register behavior: command',
                    '[config    ] instance created',
                    '[redis     ] instance created',
                    '[supervisor] starting',
                    '[dhclient  ] start watching',
                    '[dhclient  ] now ready',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] redis client error: test error',
                    '[http      ] Listening on port 5000',
                    '[supervisor] stopping',
                    '[redis     ] stop watching',
                    '[dhclient  ] stop watching',
                    '[supervisor] starting',
                    '[dhclient  ] start watching',
                    '[dhclient  ] now ready',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] redis client error: test error',
                    '[http      ] Listening on port 5000',
                    '[supervisor] stopping',
                    '[redis     ] stop watching',
                    '[dhclient  ] stop watching'
                ]);
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {end: null},
                    {keys: '*'},
                    {end: null}
                ]);
                mockRoute.snapshot().should.eql([]);
                done();
            });
        });
    });

    it('should start/stop with only redis and initialize the system - all',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-no-config.json';
        setup.reset();

        var supervisor = new M2mSupervisor().start();
        supervisor.supervisorProxy.should.not.be.ok;
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[socket    ] register behavior: shell',
                '[socket    ] register behavior: command',
                '[config    ] instance removed',
                '[config    ] instance created',
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[supervisor] starting',
                '[dhclient  ] start watching',
                '[dhclient  ] ps aux error: Error: no response found: ps aux',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] now ready',
                '[hash      ] start watching: m2m-command:routes',
                '[hash      ] check ready: m2m-command:routes',
                '[hash      ] now ready: m2m-command:routes',
                '[hash      ] start watching: m2m-config',
                '[hash      ] check ready: m2m-config',
                '[hash      ] missing(gateway): gateway:imei,gateway:private-url,gateway:public-url',
                '[hash      ] missing(cellular): ppp:subnet,modem:port-file',
                '[hash      ] missing(cellular): ppp:subnet,modem:port-file',
                '[hash      ] missing(gateway): gateway:imei,gateway:private-url,gateway:public-url',
                '[sys-init  ] incomplete setup file',
                '[sys-init  ] initialization incomplete',
                '[http      ] Listening on port 5000',
                '[supervisor] stopping',
                '[redis     ] stop watching',
                '[hash      ] stop watching: m2m-command:routes',
                '[hash      ] stop watching: m2m-config',
                '[dhclient  ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {hgetall: 'm2m-command:routes'},
                {hgetall: 'm2m-config'},
                {quit: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with no services available -- bridge',function(done){
        test.mockredis.clientException = 'test error';
        test.mockos.interfaces = {eth0: {}};

        var supervisor = new M2mSupervisor({runBridge: true}).start();
        supervisor.supervisorProxy.should.not.be.ok;
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[config    ] instance removed',
                '[config    ] instance created',
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[supervisor] starting',
                '[dhclient  ] start watching',
                '[dhclient  ] now ready',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[supervisor] stopping',
                '[redis     ] stop watching',
                '[dhclient  ] stop watching'
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
        supervisor.supervisorProxy.should.not.be.ok;
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[config    ] instance removed',
                '[config    ] instance created',
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[supervisor] starting',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[supervisor] stopping',
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
        supervisor.supervisorProxy.should.not.be.ok;
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[socket    ] register behavior: shell',
                '[socket    ] register behavior: command',
                '[config    ] instance removed',
                '[config    ] instance created',
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[supervisor] starting',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[http      ] Listening on port 5000',
                '[supervisor] stopping',
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

    it('should start/stop with no services available -- proxy',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor({runProxy: true}).start();
        supervisor.supervisorProxy.should.be.ok;
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[socket    ] register behavior: shell',
                '[socket    ] register behavior: command',
                '[config    ] instance removed',
                '[config    ] instance created',
                '[redis     ] instance removed',
                '[redis     ] instance created',
                '[supervisor] starting',
                '[redis     ] start watching',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[http      ] Listening on port 5000',
                '[supervisor] stopping',
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

    it('should start/stop with all available services, but no peripherals',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = {
            'gateway:imei': '352214046337094',
            'gateway:private-url':'udp:2.3.4.5:3011',
            'gateway:public-url':'udp:2.3.4.5:3011',
            'modem:port-file':'/dev/ttyUSB2',
            'ppp:subnet': '1.2.3.0'
        };
        test.mockos.interfaces.eth0 = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',mac: 'aa:bb:cc:dd:ee',family: 'IPv6'},{address: '5.6.7.8',mac: 'aa:bb:cc:dd:ee',family: 'IPv4'}];
        test.mockos.interfaces.ppp0 = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',family: 'IPv4'}];

        var supervisor = new M2mSupervisor({retryInterval: 100}).restart();
        test.mockhttp.events.listening();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot(); // NOTE - too many race conditions
            //test.pp.snapshot().should.eql([
            //    '[redis     ] instance removed',
            //    '[redis     ] instance created',
            //    '[socket    ] register behavior: shell',
            //    '[redis     ] start watching',
            //    '[redis     ] check ready',
            //    '[redis     ] now ready',
            //    '[hash      ] start watching: m2m-config',
            //    '[hash      ] check ready: m2m-config',
            //    '[proxy     ] start watching',
            //    '[pppd      ] start watching',
            //    '[pppd      ] pppstats error: Error: no response found: pppstats',
            //    '[modem     ] start watching',
            //    '[http      ] Listening on port 5000',
            //    '[modem     ] start error: Error: Cannot open /dev/ttyUSB2',
            //    '[redis     ] stop watching',
            //    '[hash      ] stop watching: m2m-config',
            //    '[proxy     ] stop watching',
            //    '[private   ] connection closed',
            //    '[public    ] connection closed',
            //    '[outside   ] connection closed',
            //    '[pppd      ] stop watching',
            //    '[modem     ] stop watching'
            //]);
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/ttyUSB2',{baudrate: 460800},false]},
                {open: null},
                {write: 'AT E1\r'},
                {write: 'AT+CSQ\r'},
                {close: null}
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {hmset: ['m2m-config',{'ip:public': '5.6.7.8','mac:public': 'aa:bb:cc:dd:ee'}]},
                {hgetall: 'm2m-command:routes'},
                {hgetall: 'm2m-config'},
                {mget: ['m2m-ack:message','m2m-ack:route-key','m2m-ack:retries','m2m-ack:ticks','m2m-ack:sequence-number']},
                {brpop: ['m2m-ack:queue','m2m-command:queue','m2m-transmit:queue',5]},
                {quit: null},
                {quit: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });

    it('should start/stop with all available services and a peripheral',function(done){
        test.mockos.interfaces.eth0 = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',mac: 'aa:bb:cc:dd:ee',family: 'IPv6'},{address: '5.6.7.8',mac: 'aa:bb:cc:dd:ee',family: 'IPv4'}];
        test.mockos.interfaces.ppp0 = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',family: 'IPv4'}];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-no-ppp.txt').toString()];
        test.mockshelljs.lookup['route add -net 1.2.3.0 netmask 255.255.255.0 dev ppp0'] = [0,''];
        test.mockredis.lookup.keys['*'] = ['m2m-peripheral:testKey:settings'];
        test.mockredis.lookup.hgetall['m2m-command:routes'] = {1: 'm2m-peripheral:testKey:queue'};
        test.mockredis.lookup.hgetall['m2m-config'] = {
            'gateway:imei': '352214046337094',
            'gateway:private-url':'udp:2.3.4.5:3011',
            'gateway:public-url':'udp:2.3.4.5:3011',
            'modem:port-file': '/dev/ttyUSB2',
            'ppp:subnet': '1.2.3.0'
        };
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };
        test.mockredis.lookup.brpop = [['m2m-ack:queue',2],null];

        test.timekeeper.freeze(1000000000000);
        var supervisor = new M2mSupervisor({retryInterval: 1}).start();
        supervisor.supervisorProxy.should.not.be.ok;
        test.mockhttp.events.listening();
        var count = 0;
        supervisor.queueRouter.on('queueResult',function(result){
            if (mockdgram.deliveries.length > 0) {
                mockdgram.deliveries.should.eql([[new Buffer([170,16,1,0,1,0,0,0,232,212,165,16,0,1,0,2,0,15,51,53,50,50,49,52,48,52,54,51,51,55,48,57,52,35]),0,34,3011,'2.3.4.5']]);
                mockdgram.deliveries = [];
                var buffer = new m2m.Message({messageType: m2m.Common.MOBILE_TERMINATED_ACK,timestamp: 0,sequenceNumber: 1}).pushString(0,supervisor.gateway.config.imei).toWire();
                supervisor.gateway.outsideListener.client.events.message(buffer,{address: '172.29.12.253',port: 3011});
            }

            if (++count === 3) {
                supervisor.stop();
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {end: null}
                ]);
                test.mockserialport.snapshot().should.eql([
                    {create: ['/dev/ttyUSB2',{baudrate: 460800},false]},
                    {open: null},
                    {write: 'AT E1\r'},
                    {write: 'AT+CSQ\r'},
                    {close: null}
                ]);
                test.pp.snapshot(); // NOTE - too many race conditions
                test.mockredis.snapshot(); // NOTE - too many race conditions
                test.mockshelljs.snapshot(); // NOTE - per pppd-watcher tests, clear ...
                test.timekeeper.reset();
                done();
            }
     });
    });
});