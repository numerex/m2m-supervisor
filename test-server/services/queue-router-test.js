var test = require('../test');
var QueueRouter = require(process.cwd() + '/services/queue-router');

describe('QueueRouter',function() {
    
    var redis = null;
    var mockdgram = null;
    var mockRoute = require(process.cwd() + '/test-server/mocks/route-test');
    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');
    var testGateway = Object.freeze(helpers.hash2config({'gateway:imei': '123456789012345'},hashkeys.gateway));

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        mockRoute.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var router = new QueueRouter(redis);
        router.config.should.eql({idleReport: 12,maxRetries: 5,timeoutInterval: 5});
        router.routes.should.eql({});
        router.transmitArgs.should.eql(['m2m-ack:queue','m2m-transmit:queue',5]);
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should properly initialize data with all arguments',function(){
        var router = new QueueRouter(redis,testGateway,{idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.addRoute(mockRoute);
        router.config.should.eql({idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.gateway.should.eql(testGateway);
        router.routes.should.eql({testQueue: mockRoute});
        router.transmitArgs.should.eql(['m2m-ack:queue','m2m-transmit:queue','testQueue',1]);
        test.pp.snapshot().should.eql([
            '[router    ] add route: testQueue'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect an unexpected unsolicited message',function(){
        var router = new QueueRouter(redis);
        router.client.client.events.message('test',{address: 'localhost',port:1234});
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([
            '[router    ] incoming - size: 4 from: localhost:1234',
            '[router    ] unexpected response: "test"'
        ]);
    });

    it('should throw an error if start called twice',function(done){
        var router = new QueueRouter(redis);
        router.start();
        test.expect(function(){ router.start(); }).to.throw('already started');
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start router',
            '[router    ] stop router'
        ]);
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var router = new QueueRouter(redis);
        test.expect(function(){ router.stop(); }).to.throw('not started');
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should log an idle message if nothing in the queues',function(done){
        var events = [];
        var router = new QueueRouter(redis,testGateway).on('note',function(event){
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
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs}
                ]);
                test.pp.snapshot().should.eql([
                    '[router    ] start router',
                    '[router    ] idle: 12',
                    '[router    ] stop router'
                ]);
                done();
            }
        }).start();
    });

    it('should ignore an unexpected ack',function(done){
        test.mockredis.lookup.brpop = [['m2m-ack:queue','1']];

        var router = new QueueRouter(redis,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('ignore');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] ignoring queue entry: 1',
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should detect an invalid message',function(done){
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{...']];

        var count = 0;
        var router = new QueueRouter(redis,testGateway).on('note',function(event){
            event.should.eql('error');
            if (count++ <= 0) return;

            router.stop();
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] json error: SyntaxError: Unexpected token .',
                '[router    ] invalid message received: {...',
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should transmit a basic message providing sequenceNumber',function(done){
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"eventCode":10,"timestamp":0,"sequenceNumber":1,"11":12,"13":"string","14":null}']];

        var router = new QueueRouter(redis,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs},
                {mset: [
                    'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12},{"type":2,"id":13,"value":"string"}]}',
                    'm2m-ack:route-key','none',
                    'm2m-ack:retries',0,
                    'm2m-ack:sequence-number',1
                ]}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12},{"type":2,"id":13,"value":"string"}]}',
                "[router    ] outgoing - size: 49 from: localhost:4001",
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should transmit a basic message without a sequenceNumber or timestamp (and HACK an undefined attribute for code coverage)',function(done){
        test.timekeeper.freeze(1000000000000);
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"hack":1}']];
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = 1;

        var router = new QueueRouter(redis,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.transmitArgs},
                {incr: 'm2m-transmit:last-sequence-number'},
                {mset: [
                    'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":1000000000000,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                    'm2m-ack:route-key','none',
                    'm2m-ack:retries',0,
                    'm2m-ack:sequence-number',2
                ]}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":1000000000000,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                "[router    ] outgoing - size: 34 from: localhost:4001",
                '[router    ] stop router'
            ]);
            test.timekeeper.reset();
            done();
        }).start();
    });

    it('should retry several times and then discard a message that is not acked',function(done){
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-ack:route-key'] = 'testQueue';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter(redis,testGateway)
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
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{del: QueueRouter.ACK_STATE_KEYS}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[router    ] add route: testQueue',
                        '[router    ] start router',
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
                        '[router    ] too many retries: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                        '[test-route] error: 2',
                        '[router    ] stop router'
                    ]);
                    mockRoute.snapshot().should.eql([{error: 2}]);
                    done();
                }
            })
            .addRoute(mockRoute)
            .start();
    });

    it('should handle an ack of an expected message',function(done){
        test.mockredis.lookup.brpop = [['m2m-ack:queue','2']];
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:route-key'] = 'testQueue';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter(redis,testGateway)
            .on('note',function(event){
                events.push(event);
                if (event === 'ack') {
                    router.stop();
                    test.mockredis.snapshot().should.eql([
                        {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.ackArgs},{del: QueueRouter.ACK_STATE_KEYS}
                    ]);
                    test.pp.snapshot().should.eql([
                        '[router    ] add route: testQueue',
                        '[router    ] start router',
                        '[router    ] acked: 2',
                        '[test-route] ack: 2',
                        '[router    ] stop router'
                    ]);
                    mockRoute.snapshot().should.eql([{ack: 2}]);
                    done();
                }
            })
            .addRoute(mockRoute)
            .start();
    });

    it('should handle an routed command',function(done){
        test.mockredis.lookup.brpop = [['testQueue','"test command"']];

        var router = new QueueRouter(redis,testGateway)
            .on('note',function(){
                router.stop();
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.transmitArgs}
                ]);
                test.pp.snapshot().should.eql([
                    '[router    ] add route: testQueue',
                    '[router    ] start router',
                    '[router    ] route(testQueue): "test command"',
                    '[test-route] command: test command',
                    '[router    ] stop router'
                ]);
                mockRoute.snapshot().should.eql([{command: 'test command'}]);
                done();
            })
            .addRoute(mockRoute)
            .start();
    });

});