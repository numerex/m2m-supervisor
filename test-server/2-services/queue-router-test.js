var test = require('../test');
var QueueRouter = require(process.cwd() + '/services/queue-router');

describe('QueueRouter',function() {
    
    var mockdgram = null;
    var mockRoute = require(process.cwd() + '/test-server/mocks/route-test');
    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');
    var testGateway = Object.freeze(helpers.hash2config({'gateway:imei': '123456789012345'},hashkeys.gateway));

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        mockRoute.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var router = new QueueRouter();
        router.config.should.eql({idleReport: 12,maxRetries: 5,timeoutInterval: 5});
        router.routes.should.eql({});
        router.transmitArgs.should.eql(['m2m-ack:queue','m2m-command:queue','m2m-transmit:queue',5]);
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should properly initialize data with all arguments',function(){
        var router = new QueueRouter({idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.addRoute(1,mockRoute);
        router.config.should.eql({idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.queues.should.eql({1: mockRoute.queueKey});
        router.routes.should.eql({testQueue: mockRoute});
        router.transmitArgs.should.eql(['m2m-ack:queue','m2m-command:queue','m2m-transmit:queue','testQueue',1]);
        test.pp.snapshot().should.eql([
            '[router    ] add route(testQueue): 1'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect an unexpected unsolicited message',function(){
        var router = new QueueRouter();
        router.listener.client.events.message('test',{address: 'localhost',port:1234});
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([
            '[router    ] incoming - size: 4 from: localhost:1234',
            '[router    ] unexpected response: "test"'
        ]);
    });

    it('should throw an error if start called twice',function(done){
        var router = new QueueRouter();
        router.start(testGateway);
        test.expect(function(){ router.start(testGateway); }).to.throw('already started');
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start watching',
            '[router    ] stop watching'
        ]);
        test.mockredis.snapshot().should.eql([
            {quit: null}
        ]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var router = new QueueRouter();
        test.expect(function(){ router.stop(); }).to.throw('not started');
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should log an idle message if nothing in the queues',function(done){
        var events = [];
        var router = new QueueRouter().on('note',function(event){
            events.push(event);
            if (events.length >= 12) {
                router.stop();
                events.should.eql(['idle','idle','idle','idle','idle','idle','idle','idle','idle','idle','idle','idle']);
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[router    ] start watching',
                    '[router    ] idle: 12',
                    '[router    ] stop watching'
                ]);
                done();
            }
        }).start(testGateway);
    });

    it('should ignore an unexpected ack',function(done){
        test.mockredis.lookup.brpop = [['m2m-ack:queue','1']];

        var router = new QueueRouter().on('note',function(event){
            router.stop();
            event.should.eql('ignore');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs},
                {quit: null}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start watching',
                '[router    ] ignoring queue entry: 1',
                '[router    ] stop watching'
            ]);
            done();
        }).start(testGateway);
    });

    it('should detect an invalid message',function(done){
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{...']];

        var count = 0;
        var router = new QueueRouter().on('note',function(event){
            event.should.eql('error');
            if (count++ <= 0) return;

            router.stop();
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs},
                {quit: null}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start watching',
                '[router    ] json error: SyntaxError: Unexpected token .',
                '[router    ] invalid message received: {...',
                '[router    ] stop watching'
            ]);
            done();
        }).start(testGateway);
    });

    it('should transmit a basic message providing sequenceNumber',function(done){
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"routeKey":"testQueue","eventCode":10,"timestamp":0,"sequenceNumber":1,"11":12,"13":"string","14":null,"15":"\\u0001"}']];

        var router = new QueueRouter().on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            var redisSnapshot = test.mockredis.snapshot();
            var ppSnapshot = test.pp.snapshot();
            if (process.version > 'v0.12.') { // NOTE - v0.10 (used on Travis-CI) encodes buffer objects differently, making string matching difficult...
                redisSnapshot.should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},
                    {brpop: router.transmitArgs},
                    {mset: [
                        'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12},{"type":2,"id":13,"value":"string"},{"type":11,"id":15,"value":{"type":"Buffer","data":[1]}}]}',
                        'm2m-ack:route-key','testQueue',
                        'm2m-ack:retries',0,
                        'm2m-ack:sequence-number',1
                    ]},
                    {quit: null}
                ]);
                ppSnapshot.should.eql([
                    '[router    ] start watching',
                    '[router    ] valid message received: {"routeKey":"testQueue","eventCode":10,"timestamp":0,"sequenceNumber":1,"11":12,"13":"string","14":null,"15":"\\u0001"}',
                    '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12},{"type":2,"id":13,"value":"string"},{"type":11,"id":15,"value":{"type":"Buffer","data":[1]}}]}',
                    "[router    ] outgoing - size: 54 from: localhost:4001",
                    '[router    ] stop watching'
                ]);
            }
            done();
        }).start(testGateway);
    });

    it('should transmit a basic message without a sequenceNumber or timestamp (and HACK an undefined attribute for code coverage)',function(done){
        test.timekeeper.freeze(1000000000000);
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"routeKey":"testQueue","hack":1}']];
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = 1;

        var router = new QueueRouter().on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs},
                {incr: 'm2m-transmit:last-sequence-number'},
                {mset: [
                    'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":1000000000000,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                    'm2m-ack:route-key','testQueue',
                    'm2m-ack:retries',0,
                    'm2m-ack:sequence-number',2
                ]},
                {quit: null}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start watching',
                '[router    ] valid message received: {"routeKey":"testQueue","hack":1}',
                '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":1000000000000,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                "[router    ] outgoing - size: 34 from: localhost:4001",
                '[router    ] stop watching'
            ]);
            test.timekeeper.reset();
            done();
        }).start(testGateway);
    });

    it('should retry several times and then discard a message that is not acked',function(done){
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-ack:route-key'] = 'testQueue';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter()
            .on('note',function(event){
                events.push(event);
                if (event === 'error') {
                    router.stop();
                    test.mockredis.snapshot().should.eql([
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{incr: 'm2m-ack:retries'},
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{incr: 'm2m-ack:retries'},
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{incr: 'm2m-ack:retries'},
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{incr: 'm2m-ack:retries'},
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{incr: 'm2m-ack:retries'},
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{del: QueueRouter.ACK_STATE_KEYS},
                        {quit: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[router    ] add route(testQueue): 1',
                        '[router    ] start watching',
                        '[router    ] retry: 2',
                        '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        "[router    ] outgoing - size: 34 from: localhost:4001",
                        '[router    ] retry: 2',
                        '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        "[router    ] outgoing - size: 34 from: localhost:4001",
                        '[router    ] retry: 2',
                        '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        "[router    ] outgoing - size: 34 from: localhost:4001",
                        '[router    ] retry: 2',
                        '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        "[router    ] outgoing - size: 34 from: localhost:4001",
                        '[router    ] retry: 2',
                        '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        "[router    ] outgoing - size: 34 from: localhost:4001",
                        '[router    ] too many retries: 2',
                        '[test-route] error: 2',
                        '[router    ] stop watching'
                    ]);
                    mockRoute.snapshot().should.eql([{error: 2}]);
                    done();
                }
            })
            .addRoute(1,mockRoute)
            .start(testGateway);
    });

    it('should handle an ack of an expected message',function(done){
        test.mockredis.lookup.brpop = [['m2m-ack:queue','2']];
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:route-key'] = 'testQueue';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter()
            .on('note',function(event){
                events.push(event);
                if (event === 'ack') {
                    router.stop();
                    test.mockredis.snapshot().should.eql([
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{del: QueueRouter.ACK_STATE_KEYS},
                        {quit: null}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[router    ] add route(testQueue): 1',
                        '[router    ] start watching',
                        '[router    ] acked: 2',
                        '[test-route] ack: 2',
                        '[router    ] stop watching'
                    ]);
                    mockRoute.snapshot().should.eql([{ack: 2}]);
                    done();
                }
            })
            .addRoute(1,mockRoute)
            .start(testGateway);
    });

    it('should handle an routed command',function(done){
        test.mockredis.lookup.brpop = [['testQueue','"test command"']];

        var router = new QueueRouter()
            .on('note',function(){
                router.stop();
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[router    ] add route(testQueue): 1',
                    '[router    ] start watching',
                    '[router    ] route(testQueue): "test command"',
                    '[test-route] command: test command',
                    '[router    ] stop watching'
                ]);
                mockRoute.snapshot().should.eql([{command: 'test command'}]);
                done();
            })
            .addRoute(1,mockRoute)
            .start(testGateway);
    });

    it('should detect a client error',function(done) {
        var router = new QueueRouter();
        router.start(testGateway);
        test.mockredis.events.error('test error');
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start watching',
            '[router    ] redis client error: test error',
            '[router    ] stop watching'
        ]);
        test.mockredis.snapshot().should.eql([
            {end: null}
        ]);
        done();
    });

});