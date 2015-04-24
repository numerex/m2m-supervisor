var test = require('../test');
var RedisWatcher = require(process.cwd() + '/services/redis-watcher');

describe('RedisWatcher',function() {

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
        var watcher = new RedisWatcher();
        watcher.config.should.eql({retryInterval: 5000});
        test.pp.snapshot().should.eql([
            '[redis     ] instance created'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should properly initialize data with all arguments',function(){
        var watcher = new RedisWatcher({retryInterval: 1000,extra: 1});
        watcher.config.should.eql({retryInterval: 1000,extra: 1});
        test.pp.snapshot().should.eql([
            '[redis     ] instance removed',
            '[redis     ] instance created'
        ]);
        test.mockredis.snapshot().should.eql([]);
    });

    it('should retry if redis client throws an error when starting up',function(done){
        test.mockredis.clientException = 'test error';

        var count = 0;
        var watcher = new RedisWatcher({retryInterval: 10})
            .on('ready',function(){ false.should.be.ok; })
            .on('retry',function(){
                if (count++ > 0) {
                    watcher.stop();
                    test.pp.snapshot().should.eql([
                        '[redis     ] instance removed',
                        '[redis     ] instance created',
                        '[redis     ] start watching',
                        '[redis     ] redis client error: test error',
                        '[redis     ] redis client error: test error',
                        '[redis     ] stop watching'
                    ]);
                    test.mockredis.snapshot().should.eql([
                        {keys: '*'},
                        {end: null},
                        {keys: '*'},
                        {end: null}
                    ]);
                    done();
                }
            })
            .start();
    });

    it('should report NOT ready and then retry if redis client throws an error AFTER starting up',function(done){
        var count = 0;
        var watcher = new RedisWatcher({retryInterval: 10});
        watcher
            .on('ready',function(client){
                count++;
                if (!client)
                    count.should.equal(2);
                else {
                    count.should.equal(1);
                    test.mockredis.events.error(test.mockredis.clientException = 'test error');
                }
            })
            .on('retry',function(){
                if (count++ > 3) {
                    watcher.stop();
                    test.pp.snapshot().should.eql([
                        '[redis     ] instance removed',
                        '[redis     ] instance created',
                        '[redis     ] start watching',
                        '[redis     ] client ready',
                        '[redis     ] redis client error: test error',
                        '[redis     ] client no longer ready',
                        '[redis     ] redis client error: test error',
                        '[redis     ] redis client error: test error',
                        '[redis     ] stop watching'
                    ]);
                    test.mockredis.snapshot().should.eql([
                        {keys: '*'},
                        {end: null},
                        {keys: '*'},
                        {end: null}
                    ]);
                    done();
                }
            })
            .start();
    });

    it('should return emit ready if redis client successfully created',function(done){
        var count = 0;
        var watcher = new RedisWatcher();
        watcher.on('retry',function(){ false.should.be.ok; });
        watcher.on('ready',function(client){
            count++;
            if (client) {
                watcher.ready().should.be.ok;
                count.should.equal(1);
                watcher.stop();
            } else {
                watcher.ready().should.not.be.ok;
                count.should.equal(2);
                test.pp.snapshot().should.eql([
                    '[redis     ] instance removed',
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] client ready',
                    '[redis     ] stop watching'
                ]);
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                done();
            }
        });
        watcher.start();
    });

    it('should start/stop a client watcher with ready events',function(done){
        var clientWatcher = {
            calls: [],
            started: function() { return !!clientWatcher.client; },
            start: function(client) {
                clientWatcher.client = client;
                clientWatcher.calls.push('start');
            },
            stop: function(){
                clientWatcher.client = null;
                clientWatcher.calls.push('stop');
            }
        };
        var watcher = new RedisWatcher();
        watcher.addClientWatcher(clientWatcher);
        watcher.start();
        watcher.stop();
        clientWatcher.calls.should.eql(['start','stop']);
        test.pp.snapshot().should.eql([
            '[redis     ] instance removed',
            '[redis     ] instance created',
            '[redis     ] start watching',
            '[redis     ] client ready',
            '[redis     ] stop watching'
        ]);
        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {quit: null}
        ]);
        done();
    });

    it('should stop a client watcher added after ready',function(done){
        var clientWatcher = {
            calls: [],
            started: function() { return !!clientWatcher.client; },
            start: function(client) {
                clientWatcher.client = client;
                clientWatcher.calls.push('start');
            },
            stop: function(){
                clientWatcher.client = null;
                clientWatcher.calls.push('stop');
            }
        };
        var watcher = new RedisWatcher();
        watcher.start();
        clientWatcher.client = watcher.client;
        watcher.addClientWatcher(clientWatcher);
        watcher.stop();
        clientWatcher.calls.should.eql(['stop']);
        test.pp.snapshot().should.eql([
            '[redis     ] instance removed',
            '[redis     ] instance created',
            '[redis     ] start watching',
            '[redis     ] client ready',
            '[redis     ] stop watching'
        ]);
        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {quit: null}
        ]);
        done();
    });

    it('should throw an error if start called twice',function(done){
        var watcher = new RedisWatcher();
        watcher.start();
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[redis     ] instance removed',
            '[redis     ] instance created',
            '[redis     ] start watching',
            '[redis     ] client ready',
            '[redis     ] stop watching'
        ]);
        test.mockredis.snapshot().should.eql([
            {keys: '*'},
            {quit: null}
        ]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new RedisWatcher();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([
            '[redis     ] instance removed',
            '[redis     ] instance created'
        ]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});
