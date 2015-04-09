var test = require('../test');
var RedisCheckpoint = require(process.cwd() + '/lib/redis-checkpoint');

describe('RedisCheckpoint',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
    });

    it('should properly initialize data with minimal arguments',function(){
        var checkpoint = new RedisCheckpoint();
        checkpoint.config.should.eql({retryInterval: 5000});
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should properly initialize data with all arguments',function(){
        var checkpoint = new RedisCheckpoint({retryInterval: 1000,extra: 1});
        checkpoint.config.should.eql({retryInterval: 1000,extra: 1});
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should retry if redis client throws an error',function(done){
        test.mockredis.clientException = 'test error';

        var count = 0;
        var checkpoint = new RedisCheckpoint({retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[redis-chk ] start checkpoint',
                    '[redis-chk ] not ready',
                    '[redis-chk ] not ready',
                    '[redis-chk ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([{quit: null}]);
                done();
            }
        });
    });

    it('should return ready if redis client successfully created',function(done){
        var checkpoint = new RedisCheckpoint();
        checkpoint.start(function(event,config){
            checkpoint.stop();
            event.should.eql('ready');
            test.pp.snapshot().should.eql([
                '[redis-chk ] start checkpoint',
                '[redis-chk ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([{quit: null}]);
            done();
        });
    });

    it('should throw an error if start called twice',function(done){
        var checkpoint = new RedisCheckpoint();
        checkpoint.start(function(){});
        test.expect(function(){ checkpoint.start(); }).to.throw('already started');
        checkpoint.stop();
        test.pp.snapshot().should.eql([
            '[redis-chk ] start checkpoint',
            '[redis-chk ] stop checkpoint'
        ]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var checkpoint = new RedisCheckpoint();
        test.expect(function(){ checkpoint.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});