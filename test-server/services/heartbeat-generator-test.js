var test = require('../test');
var HeartbeatGenerator = require(process.cwd() + '/services/heartbeat-generator');

describe('HeartbeatGenerator',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('lynx',test.mocklynx);
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.deregisterMock('lynx');
        test.mockery.disable();
        test.mocklynx.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should send a startup but then skip regular heartbeats if recent messages have been sent',function(done){
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = new Date().valueOf() + 20;
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 0;

        var events = [];
        var heartbeat = new HeartbeatGenerator({heartbeatInterval: 10});
        heartbeat.start(function(event){
            events.push(event);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','skip']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start heartbeat',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] stop heartbeat']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'sent'},
                    {increment: 'skipped'},
                    {increment: 'stopped'}
                ]);
                test.mockredis.snapshot().should.eql([
                    {lpush: ['m2m-transmit:queue','{"eventCode":1}']},
                    {get: 'm2m-transmit:last-private-timestamp'}]);
                done();
            }
        });
    });

    it('should send a startup but then skip regular heartbeats if messages are in the queue',function(done){
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = new Date().valueOf();
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 1;

        var events = [];
        var heartbeat = new HeartbeatGenerator({heartbeatInterval: 10});
        heartbeat.start(function(event){
            events.push(event);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','skip']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start heartbeat',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] stop heartbeat']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'sent'},
                    {increment: 'skipped'},
                    {increment: 'stopped'}
                ]);
                test.mockredis.snapshot().should.eql([
                    {lpush: ['m2m-transmit:queue','{"eventCode":1}']},
                    {get: 'm2m-transmit:last-private-timestamp'},
                    {llen: 'm2m-transmit:queue'}
                ]);
                done();
            }
        });
    });

    it('should send a startup and then regular heartbeats if no other messages have been sent and the queue is empty',function(done){
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = new Date().valueOf();
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];
        test.mockredis.lookup.llen['m2m-transmit:queue'] = 0;

        var events = [];
        var heartbeat = new HeartbeatGenerator({heartbeatInterval: 10});
        heartbeat.start(function(event){
            events.push(event);
            if (events.length > 1) {
                heartbeat.stop();
                events.should.eql(['heartbeat','heartbeat']);
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start heartbeat',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] send heartbeat: 0',
                    '[heartbeat ] stop heartbeat']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'sent'},
                    {increment: 'sent'},
                    {increment: 'stopped'}
                ]);
                test.mockredis.snapshot().should.eql([
                    {lpush: ['m2m-transmit:queue','{"eventCode":1}']},
                    {get: 'm2m-transmit:last-private-timestamp'},
                    {llen: 'm2m-transmit:queue'},
                    {lpush: ['m2m-transmit:queue','{"eventCode":0}']}
                ]);
                done();
            }
        });
    });

    it('should throw an error if redis fails on lpush',function(done){
        test.mockredis.errors['m2m-transmit:queue'] = 'test error';
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = 0;
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];

        var events = [];
        var heartbeat = new HeartbeatGenerator();
        heartbeat.start(function(event){
            events.push(event);
            events.should.eql(['error']);
            test.pp.snapshot().should.eql([
                '[heartbeat ] start heartbeat',
                '[heartbeat ] redis error: test error']);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'error'}
            ]);
            test.mockredis.snapshot().should.eql([
                {lpush: ['m2m-transmit:queue','{"eventCode":1}']}]);
            done();
        });
    });

    it('should throw an error if redis fails on get',function(done){
        test.mockredis.errors['m2m-transmit:last-private-timestamp'] = 'test error';
        test.mockredis.lookup.get['m2m-transmit:last-private-timestamp'] = 0;
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];

        var events = [];
        var heartbeat = new HeartbeatGenerator({heartbeatInterval: 10});
        heartbeat.start(function(event){
            events.push(event);
            if (events.length > 1) {
                events.should.eql(['heartbeat','error']);
                heartbeat.stop();
                test.pp.snapshot().should.eql([
                    '[heartbeat ] start heartbeat',
                    '[heartbeat ] send heartbeat: 1',
                    '[heartbeat ] redis error: test error',
                    '[heartbeat ] stop heartbeat']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'sent'},
                    {increment: 'error'},
                    {increment: 'stopped'}
                ]);
                test.mockredis.snapshot().should.eql([
                    {lpush: ['m2m-transmit:queue','{"eventCode":1}']},
                    {get: 'm2m-transmit:last-private-timestamp'}]);
                done();
            }
        });
    });

    it('should throw an error if start called twice',function(done){
        test.mockredis.lookup.lpush['m2m-transmit:queue'] = [];

        var watcher = new HeartbeatGenerator().start();
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[heartbeat ] start heartbeat',
            '[heartbeat ] send heartbeat: 1',
            '[heartbeat ] stop heartbeat']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'sent'},
            {increment: 'stopped'}]);
        test.mockredis.snapshot().should.eql([
            {lpush: ['m2m-transmit:queue','{"eventCode":1}']}]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new HeartbeatGenerator();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});