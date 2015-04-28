var _ = require('lodash');
var test = require('../test');
var DeviceRouter = require(process.cwd() + '/services/device-router');

describe('DeviceRouter',function() {

    var client = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        test.mocknet.reset();
        client = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('net');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.mocknet.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should start/stop with no device defined for the key',function(done){
        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){ events.push(event); });
        router.deviceKey.should.eql('testKey');
        router.queueKey.should.eql('m2m-device:testKey:queue');
        router.settingsKey.should.eql('m2m-device:testKey:settings');
        router.messageBase.should.eql({routeKey: 'm2m-device:testKey:queue'});
        router.started().should.not.be.ok;
        router.ready().should.not.be.ok;
        router.settingsWatcher.started().should.not.be.ok;
        router.settingsWatcher.ready().should.not.be.ok;
        router.start(client);
        router.started().should.be.ok;
        router.ready().should.not.be.ok;
        router.settingsWatcher.start(client);
        router.settingsWatcher.started().should.be.ok;
        router.settingsWatcher.ready().should.not.be.ok;
        _.defer(function(){
            router.stop();
            router.started().should.not.be.ok;
            router.ready().should.not.be.ok;
            router.settingsWatcher.stop();
            router.settingsWatcher.started().should.not.be.ok;
            router.settingsWatcher.ready().should.not.be.ok;
            events.should.eql(['route',null]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-device:testKey:settings'}
            ]);
            test.pp.snapshot().should.eql([
                '[dev-route ] start watching: testKey',
                '[hash      ] start watching: m2m-device:testKey:settings',
                '[hash      ] check ready: m2m-device:testKey:settings',
                '[hash      ] hash changed: m2m-device:testKey:settings',
                '[dev-route ] stop watching: testKey',
                '[hash      ] stop watching: m2m-device:testKey:settings'
            ]);
            done();
        });
    });

    it('should start/stop with a default telnet device defined for the key',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'ready') return;

                router.ready().should.be.ok;
                router.stop();
                router.settingsWatcher.stop();
                events.should.eql(['route','device','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[reader    ] start watching',
                    '[dev-route ] stop watching: testKey',
                    '[reader    ] stop watching',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should allow a defined device to have a route type of none',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'route:type': 'none'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'off') return;

                router.ready().should.not.be.ok;
                router.stop();
                router.settingsWatcher.stop();
                events.should.eql(['route','off',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[dev-route ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should allow a defined device to have a route type of none',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'route:type': 'unknown'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event,info){
                events.push([event,info]);
                if (event !== 'error') return;

                router.ready().should.not.be.ok;
                router.stop();
                router.settingsWatcher.stop();
                events.should.eql([
                    ['route',null],
                    ['error','error(testKey):unavailable route type: unknown'],
                    [null,null]
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[dev-route ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should allow a defined device to have a missing connection type',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'unknown',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event,info){
                events.push([event,info]);
                if (event !== 'error') return;

                router.ready().should.not.be.ok;
                router.stop();
                router.settingsWatcher.stop();
                events.should.eql([
                    ['route',null],
                    ['error','error(testKey):unavailable connection type: unknown'],
                    [null,null]
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[dev-route ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should start/stop with a default telnet device defined for the key',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'ready') return;

                router.ready().should.be.ok;
                router.stop();
                router.settingsWatcher.stop();
                events.should.eql(['route','device','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[reader    ] start watching',
                    '[dev-route ] stop watching: testKey',
                    '[reader    ] stop watching',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should detect a route change after start',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'ready') return;

                test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
                    'connection:type': 'telnet',
                    'connection:telnet:address': 'host',
                    'connection:telnet:port': '1234',
                    'route:type': 'none'
                };

                router.settingsWatcher.checkReady();
                _.defer(function(){
                    router.stop();
                    router.settingsWatcher.stop();
                    events.should.eql(['route','device','ready','off','route',null]);
                    test.mockredis.snapshot().should.eql([
                        {hgetall: 'm2m-device:testKey:settings'},
                        {hgetall: 'm2m-device:testKey:settings'}
                    ]);
                    test.mocknet.snapshot().should.eql([
                        {connect: {host: 'host',port: 1234}},
                        {end: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[dev-route ] start watching: testKey',
                        '[hash      ] start watching: m2m-device:testKey:settings',
                        '[hash      ] check ready: m2m-device:testKey:settings',
                        '[hash      ] hash changed: m2m-device:testKey:settings',
                        '[device    ] start watching: testKey',
                        '[hash      ] now ready: m2m-device:testKey:settings',
                        '[device    ] check ready: testKey',
                        '[device    ] now ready: testKey',
                        '[reader    ] start watching',
                        '[hash      ] check ready: m2m-device:testKey:settings',
                        '[hash      ] hash changed: m2m-device:testKey:settings',
                        '[reader    ] stop watching',
                        '[hash      ] now ready: m2m-device:testKey:settings',
                        '[dev-route ] stop watching: testKey',
                        '[hash      ] stop watching: m2m-device:testKey:settings',
                        '[device    ] stop watching: testKey'
                    ]);
                    done();
                });
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should ignore an unrelated change',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){ events.push(event); })
            .on('ready',function(ready){

                test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
                    'connection:type': 'telnet',
                    'connection:telnet:address': 'host',
                    'connection:telnet:port': '1234',
                    other: 'test'
                };

                router.settingsWatcher.checkReady();
                _.defer(function(){
                    router.stop();
                    router.settingsWatcher.stop();
                    events.should.eql(['route','device','ready',null]);
                    test.mockredis.snapshot().should.eql([
                        {hgetall: 'm2m-device:testKey:settings'},
                        {hgetall: 'm2m-device:testKey:settings'}
                    ]);
                    test.mocknet.snapshot().should.eql([
                        {connect: {host: 'host',port: 1234}},
                        {end: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[dev-route ] start watching: testKey',
                        '[hash      ] start watching: m2m-device:testKey:settings',
                        '[hash      ] check ready: m2m-device:testKey:settings',
                        '[hash      ] hash changed: m2m-device:testKey:settings',
                        '[device    ] start watching: testKey',
                        '[hash      ] now ready: m2m-device:testKey:settings',
                        '[device    ] check ready: testKey',
                        '[device    ] now ready: testKey',
                        '[reader    ] start watching',
                        '[hash      ] check ready: m2m-device:testKey:settings',
                        '[hash      ] hash changed: m2m-device:testKey:settings',
                        '[hash      ] now ready: m2m-device:testKey:settings',
                        '[dev-route ] stop watching: testKey',
                        '[reader    ] stop watching',
                        '[hash      ] stop watching: m2m-device:testKey:settings',
                        '[device    ] stop watching: testKey'
                    ]);
                    done();
                });
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should process a queue entries',function(done){
        test.mockredis.lookup.hgetall['m2m-device:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234'
        };

        var events = [];
        var router = new DeviceRouter('testKey')
            .on('status',function(event){ events.push(event); })
            .on('ready',function(event){

                router.processQueueEntry({}); // NOTE invalid entry for test coverage...

                router.processQueueEntry({command: 'test command'});
                router.reader.device.client.events.data(new Buffer('\x01test\x03'));

                test.mocknet.writeException = 'test error';
                router.processQueueEntry({command: 'test command'});

                router.stop();
                router.settingsWatcher.stop();
                events.should.eql(['route','device','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-device:testKey:settings'},
                    {lpush: ['m2m-transmit:queue','{"10":"test command","11":"\\u0001test\\u0003","12":null,"routeKey":"m2m-device:testKey:queue"}']},
                    {lpush: ['m2m-transmit:queue','{"10":null,"11":null,"12":"Error: test error","routeKey":"m2m-device:testKey:queue"}']}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {write: '\x01test command\x03'},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[dev-route ] start watching: testKey',
                    '[hash      ] start watching: m2m-device:testKey:settings',
                    '[hash      ] check ready: m2m-device:testKey:settings',
                    '[hash      ] hash changed: m2m-device:testKey:settings',
                    '[device    ] start watching: testKey',
                    '[hash      ] now ready: m2m-device:testKey:settings',
                    '[device    ] check ready: testKey',
                    '[device    ] now ready: testKey',
                    '[reader    ] start watching',
                    '[dev-route ] invalid queue entry(testKey): {}',
                    '[dev-route ] queue entry(testKey): {"command":"test command"}',
                    '[reader    ] command: "test command"',
                    '[reader    ] response: "\\u0001test\\u0003"',
                    '[dev-route ] response(testKey): "\\u0001test\\u0003"',
                    '[dev-route ] queue entry(testKey): {"command":"test command"}',
                    '[reader    ] command: "test command"',
                    '[reader    ] write error: Error: test error',
                    '[dev-route ] error(testKey): Error: test error',
                    '[dev-route ] stop watching: testKey',
                    '[reader    ] stop watching',
                    '[hash      ] stop watching: m2m-device:testKey:settings',
                    '[device    ] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
        router.settingsWatcher.start(client);
    });

    it('should receive acks and errors as a route',function(){
        var router = new DeviceRouter('testKey');
        router.noteAck(123);
        router.noteError(456);
        test.pp.snapshot().should.eql([
            '[dev-route ] ack(testKey) received: 123',
            '[dev-route ] error(testKey) received: 456'
        ]);
    });
});