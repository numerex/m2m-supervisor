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
        test.mockery.registerMock('lynx',test.mocklynx);
        test.mockery.registerMock('dgram',mockdgram = new test.mockdgram());
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('lynx');
        test.mockery.deregisterMock('redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.mocklynx.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        mockRoute.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var router = new QueueRouter(redis);
        router.config.should.eql({idleReport: 12,maxRetries: 5,timeoutInterval: 5});
        router.routes.should.eql({});
        router.routeKeys.should.eql([]);
        router.queueArgs.should.eql(['m2m-ack:queue','m2m-transmit:queue',5]);
        test.mockredis.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with all arguments',function(){
        var router = new QueueRouter(redis,{test: mockRoute},testGateway,{idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.config.should.eql({idleReport: 10,maxRetries: 2,timeoutInterval: 1});
        router.gateway.should.eql(testGateway);
        router.routes.should.eql({test: mockRoute});
        router.routeKeys.should.eql(['test']);
        router.queueArgs.should.eql(['m2m-ack:queue','m2m-transmit:queue','test',1]);
        test.mockredis.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect an unexpected unsolicited message',function(){
        var router = new QueueRouter(redis);
        router.client.client.events.message('test',{address: 'localhost',port:1234});
        test.mockredis.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
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
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'stopped'}
        ]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var router = new QueueRouter(redis);
        test.expect(function(){ router.stop(); }).to.throw('not started');
        test.mockredis.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should log an idle message if nothing in the queues',function(done){
        var events = [];
        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            events.push(event);
            if (events.length >= 12) {
                router.stop();
                events.should.eql(['idle','idle','idle','idle','idle','idle','idle','idle','idle','idle','idle','idle']);
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs}
                ]);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'stopped'}
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

        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('ignore');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.queueArgs}
            ]);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'stopped'}
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

        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('error');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.queueArgs}
            ]);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'error'},
                {increment: 'stopped'}
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
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"eventCode":10,"timestamp":0,"sequenceNumber":1,"11":12}']];

        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.queueArgs},
                {mset: [
                    'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12}]}',
                    'm2m-ack:route-key','none',
                    'm2m-ack:retries',0,
                    'm2m-ack:sequence-number',1
                ]}
            ]);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'transmit'},
                {increment: 'stopped'}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":10,"sequenceNumber":1,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"},{"type":1,"id":11,"value":12}]}',
                "[router    ] outgoing - size: 39 from: localhost:4001",
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should transmit a basic message without a sequenceNumber (and HACK an undefined attribute for code coverage)',function(done){
        test.mockredis.lookup.brpop = [['m2m-transmit:queue','{"timestamp":0,"hack":1}']];
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = 1;

        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            router.stop();
            event.should.eql('transmit');
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},
                {brpop: router.queueArgs},
                {incr: 'm2m-transmit:last-sequence-number'},
                {mset: [
                    'm2m-ack:message','{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                    'm2m-ack:route-key','none',
                    'm2m-ack:retries',0,
                    'm2m-ack:sequence-number',2
                ]}
            ]);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'transmit'},
                {increment: 'stopped'}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] transmit: {"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}',
                "[router    ] outgoing - size: 34 from: localhost:4001",
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should retry several times and then discard a message that is not acked',function(done){
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter(redis,null,testGateway).on('note',function(event){
            events.push(event);
            if (event === 'error') {
                router.stop();
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{incr: 'm2m-ack:retries'},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{incr: 'm2m-ack:retries'},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{incr: 'm2m-ack:retries'},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{incr: 'm2m-ack:retries'},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{incr: 'm2m-ack:retries'},
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{del: QueueRouter.ACK_STATE_KEYS}
                ]);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'retries'},
                    {increment: 'retries'},
                    {increment: 'retries'},
                    {increment: 'retries'},
                    {increment: 'retries'},
                    {increment: 'error'},
                    {increment: 'stopped'}
                ]);
                test.pp.snapshot().should.eql([
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
                    '[router    ] stop router'
                ]);
                done();
            }
        }).start();
    });

    it('should handle an ack of an expected message',function(done){
        test.mockredis.lookup.brpop = [['m2m-ack:queue','2']];
        test.mockredis.lookup.get['m2m-ack:message'] = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":2,"timestamp":0,"tuples":[{"type":2,"id":0,"value":"123456789012345"}]}';
        test.mockredis.lookup.get['m2m-ack:route-key'] = 'test';
        test.mockredis.lookup.get['m2m-ack:sequence-number'] = '2';
        test.mockredis.lookup.get['m2m-transmit:retries'] = '0';

        var events = [];
        var router = new QueueRouter(redis,{test: mockRoute},testGateway).on('note',function(event){
            events.push(event);
            if (event === 'ack') {
                router.stop();
                mockRoute.snapshot().should.eql([2]);
                test.mockredis.snapshot().should.eql([
                    {mget: QueueRouter.ACK_STATE_KEYS},{brpop: ['m2m-ack:queue',5]},{del: QueueRouter.ACK_STATE_KEYS}
                ]);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'ack'},
                    {increment: 'stopped'}
                ]);
                test.pp.snapshot().should.eql([
                    '[router    ] start router',
                    '[router    ] acked: 2',
                    '[router    ] stop router'
                ]);
                done();
            }
        }).start();
    });

    it('should handle an routed command',function(done){
        test.mockredis.lookup.brpop = [['test','test command']];

        var router = new QueueRouter(redis,{test: mockRoute},testGateway).on('note',function(){
            router.stop();
            mockRoute.snapshot().should.eql(['test command']);
            test.mockredis.snapshot().should.eql([
                {mget: QueueRouter.ACK_STATE_KEYS},{brpop: router.queueArgs}
            ]);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'stopped'}
            ]);
            test.pp.snapshot().should.eql([
                '[router    ] start router',
                '[router    ] route[test]: test command',
                '[router    ] stop router'
            ]);
            done();
        }).start();
    });

    it('should detect a redis error when processing redis commands',function(){
        var router = new QueueRouter(redis).start();
        router.redisCheckResult('test error',null,null);
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start router',
            '[router    ] redis check error: test error',
            '[router    ] stop router'
        ]);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect a callback exception when processing redis commands',function(){
        var router = new QueueRouter(redis).start();
        test.expect(function(){ router.redisCheckResult(null,null,null); }).to.throw('object is not a function');
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start router',
            '[router    ] check callback failure: TypeError: object is not a function',
            '[router    ] stop router'
        ]);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect check underflow',function(){
        var router = new QueueRouter(redis).start();
        router.checkDepth--;
        router.redisCheckResult(null,null,function(){});
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start router',
            '[router    ] check depth underflow: -1',
            '[router    ] stop router'
        ]);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should detect a redis error when processing redis commands',function(){
        var router = new QueueRouter(redis).start();
        router.redisLogError('test error',null);
        router.stop();
        test.pp.snapshot().should.eql([
            '[router    ] start router',
            '[router    ] redis error: test error',
            '[router    ] stop router'
        ]);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

});