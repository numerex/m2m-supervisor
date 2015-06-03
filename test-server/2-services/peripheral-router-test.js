var _ = require('lodash');
var test = require('../test');
var PeripheralRouter = require(process.cwd() + '/services/peripheral-router');

describe('PeripheralRouter',function() {

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

    it('should start/stop with no peripheral defined for the key',function(done){
        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){ events.push(event); });
        router.peripheralKey.should.eql('testKey');
        router.queueKey.should.eql('m2m-peripheral:testKey:queue');
        router.settingsKey.should.eql('m2m-peripheral:testKey:settings');
        router.messageBase.should.eql({routeKey: 'm2m-peripheral:testKey:queue'});
        router.started().should.not.be.ok;
        router.ready().should.not.be.ok;
        router.settingsWatcher.started().should.not.be.ok;
        router.settingsWatcher.ready().should.not.be.ok;
        router.start(client);
        router.started().should.be.ok;
        router.ready().should.not.be.ok;
        router.settingsWatcher.started().should.be.ok;
        router.settingsWatcher.ready().should.not.be.ok;
        _.defer(function(){
            router.stop();
            router.started().should.not.be.ok;
            router.ready().should.not.be.ok;
            router.settingsWatcher.started().should.not.be.ok;
            router.settingsWatcher.ready().should.not.be.ok;
            events.should.eql(['commands',null]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-peripheral:testKey:settings'}
            ]);
            test.pp.snapshot().should.eql([
                '[perph-rte ] start watching: testKey',
                '[hash      ] start watching: m2m-peripheral:testKey:settings',
                '[hash      ] check ready: m2m-peripheral:testKey:settings',
                '[hash      ] missing(connection): connection:telnet:address',
                '[perph-rte ] stop watching: testKey',
                '[hash      ] stop watching: m2m-peripheral:testKey:settings'
            ]);
            done();
        });
    });

    it('should detect no schedule defined',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:routing': 'scheduled',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'error') return;

                router.stop();
                events.should.eql(['peripheral','error',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([
                ]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[perph-rte ] error(testKey) status: no schedule defined',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
    });

    it('should detect an empty schedule',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:routing': 'scheduled',
            'command:schedule': 'test-schedule',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };
        //test.mockredis.lookup.hgetall['m2m-schedule:test-schedule:periods'] = {};

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'error') return;

                router.stop();
                events.should.eql(['peripheral','error',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'},
                    {hgetall: 'm2m-schedule:test-schedule:periods'}
                ]);
                test.mocknet.snapshot().should.eql([
                ]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[perph-rte ] error(testKey) status: empty schedule',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
    });

    it('should start/stop with a default telnet peripheral defined for the key',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:routing': 'scheduled',
            'command:schedule': 'test-schedule',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };
        test.mockredis.lookup.hgetall['m2m-schedule:test-schedule:periods'] = {"100": '["TEST1","TEST2"]',"200": '["TEST3"]'};

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event !== 'ready') return;

                router.ready().should.be.ok;
                router.stop();
                events.should.eql(['peripheral','commands','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'},
                    {hgetall: 'm2m-schedule:test-schedule:periods'},
                    {lpush: ['m2m-peripheral:testKey:queue','{"command":"TEST1"}']},
                    {lpush: ['m2m-peripheral:testKey:queue','{"command":"TEST2"}']},
                    {lpush: ['m2m-peripheral:testKey:queue','{"command":"TEST3"}']}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[reader    ] start watching',
                    '[hash      ] now ready: m2m-peripheral:testKey:settings',
                    '[reader    ] ready',
                    '[scheduler ] start watching: m2m-peripheral:testKey:queue',
                    '[scheduler ] schedule[100]: TEST1,TEST2',
                    '[scheduler ] schedule[200]: TEST3',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey',
                    '[scheduler ] stop watching: m2m-peripheral:testKey:queue',
                    '[reader    ] stop watching'
                ]);
                done();
            });
        router.start(client);
    });

    it('should allow a defined peripheral to have a command routing of none',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:routing': 'none',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){
                events.push(event);
                if (event === 'off') {
                    router.ready().should.not.be.ok;
                    _.defer(function(){
                        router.stop();
                    });
                } else if (event === null){
                    _.defer (function(){
                        events.should.eql(['peripheral','ready','off',null]);
                        test.mockredis.snapshot().should.eql([
                            {hgetall: 'm2m-peripheral:testKey:settings'}
                        ]);
                        test.mocknet.snapshot().should.eql([]);
                        test.pp.snapshot().should.eql([
                            '[perph-rte ] start watching: testKey',
                            '[hash      ] start watching: m2m-peripheral:testKey:settings',
                            '[hash      ] check ready: m2m-peripheral:testKey:settings',
                            '[peripheral] start watching: testKey',
                            '[peripheral] check ready: testKey',
                            '[peripheral] now ready: testKey',
                            '[hash      ] now ready: m2m-peripheral:testKey:settings',
                            '[perph-rte ] stop watching: testKey',
                            '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                            '[peripheral] stop watching: testKey'
                        ]);
                        done();
                    });
                }
            });
        router.start(client);
    });

    it('should allow a defined peripheral to have a command routing of unknown',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:routing': 'unknown',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event,info){
                events.push([event,info]);
                if (event !== 'error') return;

                router.ready().should.not.be.ok;
                router.stop();
                _.defer(function(){
                    events.should.eql([
                        ['peripheral',null],
                        ['error','error(testKey) status: unavailable command routing: unknown'],
                        [null,null]
                    ]);
                    test.mockredis.snapshot().should.eql([
                        {hgetall: 'm2m-peripheral:testKey:settings'}
                    ]);
                    test.mocknet.snapshot().should.eql([]);
                    test.pp.snapshot().should.eql([
                        '[perph-rte ] start watching: testKey',
                        '[hash      ] start watching: m2m-peripheral:testKey:settings',
                        '[hash      ] check ready: m2m-peripheral:testKey:settings',
                        '[peripheral] start watching: testKey',
                        '[peripheral] check ready: testKey',
                        '[peripheral] now ready: testKey',
                        '[perph-rte ] error(testKey) status: unavailable command routing: unknown',
                        '[perph-rte ] stop watching: testKey',
                        '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                        '[peripheral] stop watching: testKey'
                    ]);
                    done();
                });
            });
        router.start(client);
    });

    it('should allow a defined peripheral to have a missing connection type',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'unknown',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event,info){
                events.push([event,info]);
                if (event !== 'error') return;

                router.ready().should.not.be.ok;
                router.stop();
                events.should.eql([
                    ['error','error(testKey) status: unavailable connection type: unknown'],
                    [null,null]
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'}
                ]);
                test.mocknet.snapshot().should.eql([]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[perph-rte ] error(testKey) status: unavailable connection type: unknown',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey'
                ]);
                done();
            });
        router.start(client);
    });

    it('should detect a route change after start',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var checked = false;
        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){
                events.push(event);

                if (event === 'ready' && !checked) {
                    checked = true;
                    test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
                        'connection:type': 'telnet',
                        'connection:telnet:address': 'host',
                        'connection:telnet:port': '1234',
                        'command:routing': 'none'
                    };
                    router.settingsWatcher.checkReady();
                } else if (event === 'off') {
                    router.stop();
                    events.should.eql(['peripheral','commands','ready','ready','off',null]);
                    test.mockredis.snapshot().should.eql([
                        {hgetall: 'm2m-peripheral:testKey:settings'},
                        {hgetall: 'm2m-peripheral:testKey:settings'}
                    ]);
                    test.mocknet.snapshot().should.eql([
                        {connect: {host: 'host',port: 1234}},
                        {end: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[perph-rte ] start watching: testKey',
                        '[hash      ] start watching: m2m-peripheral:testKey:settings',
                        '[hash      ] check ready: m2m-peripheral:testKey:settings',
                        '[peripheral] start watching: testKey',
                        '[peripheral] check ready: testKey',
                        '[peripheral] now ready: testKey',
                        '[reader    ] start watching',
                        '[hash      ] now ready: m2m-peripheral:testKey:settings',
                        '[reader    ] ready',
                        '[hash      ] check ready: m2m-peripheral:testKey:settings',
                        '[hash      ] hash changed: m2m-peripheral:testKey:settings',
                        '[reader    ] stop watching',
                        '[perph-rte ] stop watching: testKey',
                        '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                        '[peripheral] stop watching: testKey'
                    ]);
                    done();
                }
            });
        router.start(client);
    });

    it('should ignore an unrelated change',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){ events.push(event); })
            .on('ready',function(ready){

                test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
                    'connection:type': 'telnet',
                    'connection:telnet:address': 'host',
                    'connection:telnet:port': '1234',
                    'command:command-prefix': '\\u0001',
                    'command:command-suffix': '\\u0003',
                    'command:response-prefix': '\\u0001',
                    'command:response-suffix': '\\u0003',
                    other: 'test'
                };

                router.settingsWatcher.checkReady();
                _.defer(function(){
                    router.stop();
                    events.should.eql(['peripheral','commands','ready',null]);
                    test.mockredis.snapshot().should.eql([
                        {hgetall: 'm2m-peripheral:testKey:settings'},
                        {hgetall: 'm2m-peripheral:testKey:settings'}
                    ]);
                    test.mocknet.snapshot().should.eql([
                        {connect: {host: 'host',port: 1234}},
                        {end: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[perph-rte ] start watching: testKey',
                        '[hash      ] start watching: m2m-peripheral:testKey:settings',
                        '[hash      ] check ready: m2m-peripheral:testKey:settings',
                        '[peripheral] start watching: testKey',
                        '[peripheral] check ready: testKey',
                        '[peripheral] now ready: testKey',
                        '[reader    ] start watching',
                        '[hash      ] now ready: m2m-peripheral:testKey:settings',
                        '[reader    ] ready',
                        '[hash      ] check ready: m2m-peripheral:testKey:settings',
                        '[hash      ] hash changed: m2m-peripheral:testKey:settings',
                        '[perph-rte ] stop watching: testKey',
                        '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                        '[peripheral] stop watching: testKey',
                        '[reader    ] stop watching'
                    ]);
                    done();
                });
            });
        router.start(client);
    });

    it('should process a queue entry for a scheduled command',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){ events.push(event); })
            .on('ready',function(event){

                router.processQueueEntry({}); // NOTE invalid entry for test coverage...

                router.processQueueEntry({command: 'test command1'});
                router.reader.peripheral.client.events.data(new Buffer('\x01test\x03'));

                test.mocknet.writeException = 'test error';
                router.processQueueEntry({command: 'test command2'});

                router.stop();
                events.should.eql(['peripheral','commands','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'},
                    {lpush: ['m2m-transmit:queue','{"10":"test command1","11":"\\u0001test\\u0003","12":null,"routeKey":"m2m-peripheral:testKey:queue","eventCode":10}']},
                    {lpush: ['m2m-transmit:queue','{"10":"test command2","11":null,"12":"test error","routeKey":"m2m-peripheral:testKey:queue","eventCode":10}']}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {write: '\x01test command1\x03'},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[reader    ] start watching',
                    '[hash      ] now ready: m2m-peripheral:testKey:settings',
                    '[reader    ] ready',
                    '[perph-rte ] invalid queue entry(testKey): {}',
                    '[perph-rte ] queue entry(testKey): {"command":"test command1"}',
                    '[reader    ] command: "test command1"',
                    '[reader    ] response: "\\u0001test\\u0003"',
                    '[perph-rte ] response(testKey): "\\u0001test\\u0003"',
                    '[perph-rte ] queue entry(testKey): {"command":"test command2"}',
                    '[reader    ] command: "test command2"',
                    '[reader    ] write error: test error',
                    '[perph-rte ] error(testKey) submit: test error',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey',
                    '[reader    ] stop watching'
                ]);
                done();
            });
        router.start(client);
    });

    it('should process a queue entry for a requested command and deliver it to an alternative destination',function(done){
        test.mockredis.lookup.hgetall['m2m-peripheral:testKey:settings'] = {
            'connection:type': 'telnet',
            'connection:telnet:address': 'host',
            'connection:telnet:port': '1234',
            'command:command-prefix': '\\u0001',
            'command:command-suffix': '\\u0003',
            'command:response-prefix': '\\u0001',
            'command:response-suffix': '\\u0003'
        };

        var events = [];
        var router = new PeripheralRouter('testKey')
            .on('status',function(event){ events.push(event); })
            .on('ready',function(event){

                router.processQueueEntry({}); // NOTE invalid entry for test coverage...

                router.processQueueEntry({command: 'test command',requestID: 2,destination: 'm2m-web:queue'});
                router.reader.peripheral.client.events.data(new Buffer('\x01test\x03'));

                router.stop();
                events.should.eql(['peripheral','commands','ready',null]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-peripheral:testKey:settings'},
                    {lpush: ['m2m-web:queue','{"2":2,"10":"test command","11":"\\u0001test\\u0003","12":null,"routeKey":"m2m-peripheral:testKey:queue","eventCode":11}']}
                ]);
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {write: '\x01test command\x03'},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[perph-rte ] start watching: testKey',
                    '[hash      ] start watching: m2m-peripheral:testKey:settings',
                    '[hash      ] check ready: m2m-peripheral:testKey:settings',
                    '[peripheral] start watching: testKey',
                    '[peripheral] check ready: testKey',
                    '[peripheral] now ready: testKey',
                    '[reader    ] start watching',
                    '[hash      ] now ready: m2m-peripheral:testKey:settings',
                    '[reader    ] ready',
                    '[perph-rte ] invalid queue entry(testKey): {}',
                    '[perph-rte ] queue entry(testKey): {"command":"test command","requestID":2,"destination":"m2m-web:queue"}',
                    '[reader    ] command: "test command"',
                    '[reader    ] response: "\\u0001test\\u0003"',
                    '[perph-rte ] response(testKey): "\\u0001test\\u0003"',
                    '[perph-rte ] stop watching: testKey',
                    '[hash      ] stop watching: m2m-peripheral:testKey:settings',
                    '[peripheral] stop watching: testKey',
                    '[reader    ] stop watching'
                ]);
                done();
            });
        router.start(client);
    });

    it('should receive acks and errors as a route',function(){
        var router = new PeripheralRouter('testKey');
        router.noteAck(123);
        router.noteError(456);
        test.pp.snapshot().should.eql([
            '[perph-rte ] ack(testKey) received: 123',
            '[perph-rte ] error(testKey) received: 456'
        ]);
    });
});