var test = require('../test');
var HeartbeatGenerator = require(process.cwd() + '/services/heartbeat-generator');

describe('HeartbeatGenerator',function() {

    var BASE_TIME = 1000000000000;

    var redis = null;
    var mockProxy = null;

    beforeEach(function () {
        test.timekeeper.freeze(BASE_TIME);
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
        mockProxy = {
            config: {imei: '123456789012345',heartbeatInterval: 10 / HeartbeatGenerator.MILLIS_PER_MIN},
            messages: []
        };
        mockProxy.sendPrivate = function(buffer,ignoreAckHint){
            mockProxy.messages.push([buffer.inspect(),ignoreAckHint]);
        };
        mockProxy.snapshot = function(){
            var messages = mockProxy.messages;
            mockProxy.messages = [];
            return messages;
        }
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        mockProxy.snapshot().should.eql([]);
        test.timekeeper.reset();
    });

    it('should send a startup but then skip regular heartbeats if recent messages have been sent',function(done){
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = BASE_TIME;
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 0;
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = '7';

        var events = [];
        var heartbeat = new HeartbeatGenerator(mockProxy);
        heartbeat.on('note',function(type){
            events.push(type);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','skip']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start watching',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] stop watching']);
                test.mockredis.snapshot().should.eql([
                    {incr: 'm2m-transmit:last-sequence-number'},
                    {get: 'm2m-transmit:last-private-timestamp'}]);
                mockProxy.snapshot().should.eql([['<Buffer aa 10 01 00 08 00 00 00 e8 d4 a5 10 00 01 00 02 00 0f 31 32 33 34 35 36 37 38 39 30 31 32 33 34 35 11>',8]]);
                done();
            }
        });
        heartbeat.start(mockProxy.config,redis);
    });

    it('should send a startup but then skip regular heartbeats if messages are in the queue',function(done){
        var nextTime = BASE_TIME;
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = nextTime;
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 1;
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = '7';

        var events = [];
        var heartbeat = new HeartbeatGenerator(mockProxy);
        heartbeat.on('note',function(type){
            events.push(type);
            test.timekeeper.reset();
            test.timekeeper.freeze(nextTime += 20);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','skip']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start watching',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] stop watching']);
                test.mockredis.snapshot().should.eql([
                    {incr: 'm2m-transmit:last-sequence-number'},
                    {get: 'm2m-transmit:last-private-timestamp'},
                    {llen: 'm2m-transmit:queue'}
                ]);
                mockProxy.snapshot().should.eql([['<Buffer aa 10 01 00 08 00 00 00 e8 d4 a5 10 00 01 00 02 00 0f 31 32 33 34 35 36 37 38 39 30 31 32 33 34 35 11>',8]]);
                done();
            }
        });
        heartbeat.start(mockProxy.config,redis);
    });

    it('should send a startup and then regular heartbeats if no other messages have been sent and the queue is empty',function(done){
        var nextTime = BASE_TIME;
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = nextTime;
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = '7';
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 0;

        var events = [];
        var heartbeat = new HeartbeatGenerator(mockProxy);
        heartbeat.on('note',function(type){
            events.push(type);
            test.timekeeper.reset();
            test.timekeeper.freeze(nextTime += 20);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','heartbeat']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start watching',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] send heartbeat: 0',
                    '[heartbeat ] stop watching']);
                test.mockredis.snapshot().should.eql([
                    {incr: 'm2m-transmit:last-sequence-number'},
                    {get: 'm2m-transmit:last-private-timestamp'},
                    {llen: 'm2m-transmit:queue'},
                    {incr: 'm2m-transmit:last-sequence-number'}
                ]);
                mockProxy.snapshot().should.eql([
                    ['<Buffer aa 10 01 00 08 00 00 00 e8 d4 a5 10 00 01 00 02 00 0f 31 32 33 34 35 36 37 38 39 30 31 32 33 34 35 11>',8],
                    ['<Buffer aa 10 00 00 09 00 00 00 e8 d4 a5 10 14 01 00 02 00 0f 31 32 33 34 35 36 37 38 39 30 31 32 33 34 35 18>',9]
                ]);
                done();
            }
        });
        heartbeat.start(mockProxy.config,redis);
    });

    it('should throw an error if start called twice',function(done){
        test.mockredis.lookup.get['m2m-transmit:last-sequence-number'] = '7';

        var heartbeat = new HeartbeatGenerator(mockProxy).start(mockProxy.config,redis);
        test.expect(function(){ heartbeat.start(mockProxy.config,redis); }).to.throw('already started');
        heartbeat.stop();
        test.pp.snapshot().should.eql([
            '[heartbeat ] start watching',
            '[heartbeat ] send heartbeat: 1',
            '[heartbeat ] stop watching']);
        test.mockredis.snapshot().should.eql([
            {incr: 'm2m-transmit:last-sequence-number'}
        ]);
        mockProxy.snapshot().should.eql([['<Buffer aa 10 01 00 08 00 00 00 e8 d4 a5 10 00 01 00 02 00 0f 31 32 33 34 35 36 37 38 39 30 31 32 33 34 35 11>',8]]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var heartbeat = new HeartbeatGenerator(mockProxy);
        test.expect(function(){ heartbeat.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});