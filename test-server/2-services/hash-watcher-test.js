var _ = require('lodash');
var test = require('../test');
var HashWatcher = require(process.cwd() + '/services/hash-watcher');

var hashkeys = require(process.cwd() + '/lib/config-hashkeys');

describe('HashWatcher',function() {
    
    var client = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        client = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var watcher = new HashWatcher('test');
        watcher.rootKey.should.eql('test');
        watcher.hashkeys.should.eql({});
        watcher.retryInterval.should.equal(5000);
    });

    it('should properly initialize data with all arguments',function(){
        var watcher = new HashWatcher('test',hashkeys,{retryInterval: 1000,extra: 1});
        watcher.rootKey.should.eql('test');
        watcher.hashkeys.should.eql(hashkeys);
        watcher.retryInterval.should.equal(1000);
        watcher.checkReady(); // NOTE - should be ignored...
    });

    it('should capture hash attributes when started and emit a change event',function(done){
        test.mockredis.lookup.hgetall['test'] = {test: 'test'};

        var count = 0;
        var watcher = new HashWatcher('test',null,{retryInterval: 10});
        watcher.on('change',function(hash){
            count++;
            if (hash) {
                count.should.equal(1);
                hash.should.eql({test: 'test'});
                watcher.hash.should.eql({test: 'test'});
                _.defer(function(){ watcher.stop(); });
            } else {
                count.should.equal(2);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test'}
                ]);
                test.pp.snapshot().should.eql([
                    '[hash      ] start watching: test',
                    '[hash      ] check ready: test',
                    '[hash      ] now ready: test',
                    '[hash      ] stop watching: test'
                ]);
                done();
            }
        });
        watcher.start(client);
    });

    it('should start/stop a change watcher',function(done){
        test.mockredis.lookup.hgetall['test'] = {test: 'test'};

        var lastHash = null;
        var watcher = new HashWatcher('test',null,{retryInterval: 10});
        watcher.addChangeWatcher({
            started: function(){ return !!lastHash; },
            start: function(hash){
                lastHash = hash;
                hash.should.eql({test: 'test'});
                watcher.hash.should.eql({test: 'test'});
                _.defer(function(){ watcher.stop(); });
            },
            stop: function(){
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test'}
                ]);
                test.pp.snapshot().should.eql([
                    '[hash      ] start watching: test',
                    '[hash      ] check ready: test',
                    '[hash      ] now ready: test',
                    '[hash      ] stop watching: test'
                ]);
                done();
            }
        });
        watcher.start(client);
    });

    it('should retry if a keyset watcher has requirements that are not met',function(done){
        test.mockredis.lookup.hgetall['test-hash'] = null;

        var count = 0;
        var events = [];
        var watcher = new HashWatcher('test-hash',{keyset: {test: {key: 'test-key',type: 'number',required: true}}},{retryInterval: 10});
        watcher.on('retry',function(){
            if (count++ > 0){
                watcher.stop();
                events.should.eql([]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-hash'},
                    {hgetall: 'test-hash'}
                ]);
                test.pp.snapshot().should.eql([
                    '[hash      ] start watching: test-hash',
                    '[hash      ] check ready: test-hash',
                    '[hash      ] check ready: test-hash',
                    '[hash      ] stop watching: test-hash'
                ]);
                done();
            }
        });
        var started = false;
        watcher.addKeysetWatcher('keyset',true,{
            started: function(){ return started; },
            start: function(hash){ started = true; events.push('start'); },
            stop: function(){ started = false; events.push('start'); }
        });
        watcher.start(client);
    });

    it('should start/stop a keyset watcher if requrements met',function(done){
        test.mockredis.lookup.hgetall['test-hash'] = {'test-key': '2'};

        var lastHash = null;
        var watcher = new HashWatcher('test-hash',{keyset: {test: {key: 'test-key',type: 'number',required: true}}},{retryInterval: 10});
        watcher.addKeysetWatcher('keyset',true,{
            started: function(){ return !!lastHash; },
            start: function(hash){
                lastHash = hash;
                hash.should.eql({test: 2});
                watcher.hash.should.eql({'test-key': '2'});
                _.defer(function(){ watcher.stop(); });
            },
            stop: function(){
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-hash'}
                ]);
                test.pp.snapshot().should.eql([
                    '[hash      ] start watching: test-hash',
                    '[hash      ] check ready: test-hash',
                    '[hash      ] now ready: test-hash',
                    '[hash      ] stop watching: test-hash'
                ]);
                done();
            }
        });
        watcher.start(client);
    });

    it('should stop/start a keyset watcher if there is a change after initial start',function(done){
        test.mockredis.lookup.hgetall['test-hash'] = null;

        var events = [];
        var lastHash = null;
        var watcher = new HashWatcher('test-hash',{keyset: {test: {key: 'test-key',type: 'number',required: true}}},{retryInterval: 10});
        watcher.on('change',function(hash){
            events.push({change: hash});
            if (hash === null) {
                events.should.eql([
                    {start: {test: NaN}},
                    {change: {}},
                    {stop: null},
                    {start: {test: 2}},
                    {change: {'test-key': '2'}},
                    {stop: null},
                    {change: null}
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'test-hash'},
                    {hgetall: 'test-hash'}
                ]);
                test.pp.snapshot().should.eql([
                    '[hash      ] start watching: test-hash',
                    '[hash      ] check ready: test-hash',
                    '[hash      ] now ready: test-hash',
                    '[hash      ] check ready: test-hash',
                    '[hash      ] hash changed: test-hash',
                    '[hash      ] stop watching: test-hash'
                ]);
                done();
            }
        });
        watcher.addKeysetWatcher('keyset',false,{
            started: function(){ return !!lastHash; },
            start: function(hash){
                lastHash = hash;
                events.push({start: hash});
                _.defer(function(){
                    if (events.length > 2)
                        watcher.stop();
                    else {
                        test.mockredis.lookup.hgetall['test-hash'] = {'test-key': '2'};
                        watcher.checkReady();
                    }
                });
            },
            stop: function(){
                events.push({stop: null});
            }
        });
        watcher.start(client);
    });

    it('should throw an error if start called twice',function(done){
        test.mockredis.lookup.hgetall['test'] = {test: 'test'};

        var watcher = new HashWatcher('test');
        watcher.start(client);
        test.expect(function(){ watcher.start(client); }).to.throw('already started');
        watcher.stop();
        test.mockredis.snapshot().should.eql([
            {hgetall: 'test'}
        ]);
        test.pp.snapshot().should.eql([
            '[hash      ] start watching: test',
            '[hash      ] check ready: test',
            '[hash      ] now ready: test',
            '[hash      ] stop watching: test'
        ]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new HashWatcher();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});