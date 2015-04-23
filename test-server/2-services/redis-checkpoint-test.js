var test = require('../test');
var RedisCheckpoint = require(process.cwd() + '/services/redis-checkpoint');

describe('RedisCheckpoint',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
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
        checkpoint.start(function(event){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[redis-chk ] start checkpoint',
                    '[redis-chk ] redis client error: test error',
                    '[redis-chk ] redis client error: test error',
                    '[redis-chk ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {quit: null},
                    {quit: null}
                ]);
                done();
            }
        });
    });

    it('should return ready if redis client successfully created',function(done){
        var checkpoint = new RedisCheckpoint();
        checkpoint.start(function(event){
            checkpoint.stop();
            event.should.eql('ready');
            test.pp.snapshot().should.eql([
                '[redis-chk ] start checkpoint',
                '[redis-chk ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {quit: null}
            ]);
            done();
        });
    });

    it('should throw an error if start called twice',function(done){
        var checkpoint = new RedisCheckpoint();
        checkpoint.start();
        test.expect(function(){ checkpoint.start(); }).to.throw('already started');
        checkpoint.stop();
        test.pp.snapshot().should.eql([
            '[redis-chk ] start checkpoint',
            '[redis-chk ] stop checkpoint'
        ]);
        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {quit: null}
        ]);
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
