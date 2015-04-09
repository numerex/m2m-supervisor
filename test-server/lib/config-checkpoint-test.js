var test = require('../test');
var ConfigCheckpoint = require(process.cwd() + '/lib/config-checkpoint');

describe('ConfigCheckpoint',function() {
    
    var redis = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
    });

    it('should properly initialize data with minimal arguments',function(){
        var checkpoint = new ConfigCheckpoint(redis,'test-key');
        checkpoint.key.should.eql('test-key');
        checkpoint.defaults.should.eql({});
        checkpoint.required.should.eql([]);
        checkpoint.config.should.eql({retryInterval: 5000});
    });

    it('should properly initialize data with all arguments',function(){
        var checkpoint = new ConfigCheckpoint(redis,'test-key',{test1: 1,test2: 2,retryInterval: 1000},['test1'],{retryInterval: 1000,extra: 1});
        checkpoint.key.should.eql('test-key');
        checkpoint.defaults.should.eql({test1: 1,test2: 2,retryInterval: 1000});
        checkpoint.required.should.eql(['test1']);
        checkpoint.config.should.eql({retryInterval: 1000,extra: 1});
    });

    it('should retry if redis responds with an error',function(done){
        test.mockredis.errors['test-key'] = 'test error';

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,'test-key',null,null,{retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[cfg-chk   ] start checkpoint',
                    '[cfg-chk   ] redis error: test error',
                    '[cfg-chk   ] redis error: test error',
                    '[cfg-chk   ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-key'},
                    {hgetall: 'test-key'}]);
                done();
            }
        });
    });

    it('should retry if no configuration exists',function(done){
        test.mockredis.lookup.hgetall['test-key'] = null;

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,'test-key',null,null,{retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[cfg-chk   ] start checkpoint',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-key'},
                    {hgetall: 'test-key'}]);
                done();
            }
        });
    });

    it('should retry if redis config does not meet requirements',function(done){
        test.mockredis.lookup.hgetall['test-key'] = {found: '1',other: '2'};

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,'test-key',null,['found','missing'],{retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[cfg-chk   ] start checkpoint',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-key'},
                    {hgetall: 'test-key'}]);
                done();
            }
        });
    });

    it('should return ready if redis config meets requirements',function(done){
        test.mockredis.lookup.hgetall['test-key'] = {found: '1',other: '2'};

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,'test-key',{extra: '3'},['found']);
        checkpoint.start(function(event,config){
            checkpoint.stop();
            event.should.eql('ready');
            [config].should.eql([{found: '1',other: '2',extra: '3'}]);
            test.pp.snapshot().should.eql([
                '[cfg-chk   ] start checkpoint',
                '[cfg-chk   ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'test-key'}]);
            done();
        });
    });

    it('should throw an error if start called twice',function(done){
        var checkpoint = new ConfigCheckpoint(redis,'test-key');
        checkpoint.start(function(){});
        test.expect(function(){ checkpoint.start(); }).to.throw('already started');
        checkpoint.stop();
        test.pp.snapshot().should.eql([
            '[cfg-chk   ] start checkpoint',
            '[cfg-chk   ] stop checkpoint'
        ]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var checkpoint = new ConfigCheckpoint(redis,'test-key');
        test.expect(function(){ checkpoint.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});