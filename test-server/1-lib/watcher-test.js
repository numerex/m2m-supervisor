var _ = require('lodash');
var util = require('util');

var test = require('../test');
var Watcher = require(process.cwd() + '/lib/watcher');

describe('Watcher',function() {

    var logger = require(process.cwd() + '/lib/logger')('watcher');

    beforeEach(function () {
    });

    afterEach(function () {
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var watcher = new Watcher(logger);
        watcher.retryInterval.should.eql(5000);
    });

    it('should properly initialize data with all arguments',function(){
        var watcher = new Watcher(logger,{retryInterval: 1000,extra: 1});
        watcher.retryInterval.should.eql(1000);
    });

    it('should throw an error if start called twice',function(done){
        var watcher = new Watcher(logger,{qualifier: 'test'});
        watcher.start();
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[watcher   ] start watching: test',
            '[watcher   ] stop watching: test'
        ]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new Watcher(logger);
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        done();
    });

    it('should emit ready events',function(done){
        var count = 0;
        var watcher = new Watcher(logger,{qualifier: 'test'});
        watcher.on('ready',function(ready){
            count++;
            if (ready){
                count.should.equal(1);
                watcher.ready().should.equal(true);
                watcher.stop();
            } else {
                count.should.equal(2);
                watcher.ready().should.equal(false);
                test.pp.snapshot().should.eql([
                    '[watcher   ] start watching: test',
                    '[watcher   ] check ready: test',
                    '[watcher   ] now ready: test',
                    '[watcher   ] stop watching: test'
                ]);
                done();
            }
        });
        watcher.start();
    });

    function RetryWatcher(){
        this.checkResponse = false;
        Watcher.apply(this,[logger,{qualifier: 'retry',retryInterval: 10}]);
    }

    util.inherits(RetryWatcher,Watcher);

    RetryWatcher.prototype._onStart = function(arg1,arg2){
        logger.info('start now: ' + [arg1,arg2]);
    };

    RetryWatcher.prototype._onCheckReady = function(callback){
        callback(this.checkResponse);
    };

    RetryWatcher.prototype._onStop = function(){
        logger.info('stop now');
    };

    it('should retry when not ready from the start',function(done){
        var count = 0;
        var watcher = new RetryWatcher();
        watcher.retryInterval.should.eql(10);
        watcher.on('retry',function(){
            watcher.ready().should.equal(false);
            if (count++ < 2) return;

            watcher.stop();
            test.pp.snapshot().should.eql([
                '[watcher   ] start watching: retry',
                '[watcher   ] start now: test1,test2',
                '[watcher   ] check ready: retry',
                '[watcher   ] check ready: retry',
                '[watcher   ] check ready: retry',
                '[watcher   ] stop watching: retry',
                '[watcher   ] stop now'
            ]);
            done();
        });
        watcher.start('test1','test2');
    });

    it('should retry when not ready after start',function(done){
        var count = 0;
        var watcher = new RetryWatcher();
        watcher.checkResponse = true;
        watcher.on('ready',function(ready){
            count++;
            if (ready){
                count.should.equal(1);
                watcher.ready().should.equal(true);
                _.defer(function(){
                    watcher.checkResponse = false;
                    watcher.checkReady();
                });
            } else {
                count.should.equal(2);
                watcher.ready().should.equal(false);
            }
        });
        watcher.on('retry',function(){
            count++;
            count.should.equal(3);
            watcher.stop();
            test.pp.snapshot().should.eql([
                '[watcher   ] start watching: retry',
                '[watcher   ] start now: test1,test2',
                '[watcher   ] check ready: retry',
                '[watcher   ] now ready: retry',
                '[watcher   ] check ready: retry',
                '[watcher   ] no longer ready: retry',
                '[watcher   ] stop watching: retry',
                '[watcher   ] stop now'
            ]);
            done();
        });
        watcher.start('test1','test2');
    })

});
