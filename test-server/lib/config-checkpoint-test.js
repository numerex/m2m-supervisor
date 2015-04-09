var test = require('../test');
var ConfigCheckpoint = require(process.cwd() + '/lib/config-checkpoint');

var hashkeys = require(process.cwd() + '/lib/config-hashkeys');

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
        var checkpoint = new ConfigCheckpoint(redis);
        checkpoint.hashkeys.should.eql({});
        checkpoint.required.should.eql([]);
        checkpoint.config.should.eql({retryInterval: 5000});
    });

    it('should properly initialize data with all arguments',function(){
        var checkpoint = new ConfigCheckpoint(redis,{test: {key: 'test-key',type: 'number',default: 1}},['missing'],{retryInterval: 1000,extra: 1});
        checkpoint.hashkeys.should.eql({test: {key: 'test-key',type: 'number',default: 1}});
        checkpoint.required.should.eql(['missing']);
        checkpoint.config.should.eql({retryInterval: 1000,extra: 1});
    });

    it('should retry if redis responds with an error',function(done){
        test.mockredis.errors['m2m-config'] = 'test error';

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,null,null,{retryInterval: 10});
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
                    {hgetall: 'm2m-config'},
                    {hgetall: 'm2m-config'}]);
                done();
            }
        });
    });

    it('should retry if no configuration exists',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = null;

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,null,null,{retryInterval: 10});
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
                    {hgetall: 'm2m-config'},
                    {hgetall: 'm2m-config'}]);
                done();
            }
        });
    });

    it('should retry if redis config does not meet requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = {found: '1',other: '2'};

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,null,['found','missing'],{retryInterval: 10});
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
                    {hgetall: 'm2m-config'},
                    {hgetall: 'm2m-config'}]);
                done();
            }
        });
    });

    it('should return ready if redis config meets requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = {'gateway:imei': '123456789012345','gateway:private-host': 'private-host','gateway:public-host': 'public-host'};

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,hashkeys.gateway,[hashkeys.gateway.imei.key]);
        checkpoint.start(function(event,config){
            checkpoint.stop();
            event.should.eql('ready');
            config.should.eql({
                imei: '123456789012345',
                primary: 'public',
                privateHost: 'private-host',
                privatePort: 3011,
                privateRelay: 4000,
                publicHost: 'public-host',
                publicPort: 3011,
                publicRelay: 4001
            });
            test.pp.snapshot().should.eql([
                '[cfg-chk   ] start checkpoint',
                '[cfg-chk   ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-config'}]);
            done();
        });
    });

    it('should throw an error if start called twice',function(done){
        var checkpoint = new ConfigCheckpoint(redis);
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
        var checkpoint = new ConfigCheckpoint(redis);
        test.expect(function(){ checkpoint.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});