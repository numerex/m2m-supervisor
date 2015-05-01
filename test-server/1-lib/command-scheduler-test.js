var _ = require('lodash');

var test = require('../test');

var CommandScheduler = require(process.cwd() + '/lib/command-scheduler');

describe('CommandScheduler',function() {

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

    it('should do nothing after start with no schedules',function(done){
        var scheduler = new CommandScheduler('test',[]).start(client);
        scheduler.intervals.length.should.equal(0);
        scheduler.stop();
        _.defer(function(){
            test.mockredis.snapshot().should.eql([]);
            test.pp.snapshot().should.eql([
                '[scheduler ] start watching: test',
                '[scheduler ] stop watching: test'
            ]);
            done();
        });
    });

    it('should execute all schedules immediately',function(done){
        var scheduler = new CommandScheduler('test',{'1': '["test1","test2"]',"2": '["test3"]'}).start(client);
        scheduler.intervals.length.should.equal(2);
        scheduler.stop();
        _.defer(function(){
            test.mockredis.snapshot().should.eql([
                {lpush: ['test','{"command":"test1"}']},
                {lpush: ['test','{"command":"test2"}']},
                {lpush: ['test','{"command":"test3"}']}
            ]);
            test.pp.snapshot().should.eql([
                '[scheduler ] start watching: test',
                '[scheduler ] schedule[1]: test1,test2',
                '[scheduler ] schedule[2]: test3',
                '[scheduler ] stop watching: test'
            ]);
            done();
        });
    });

    it('should ensure that schedules with null commands are skipped',function(done){
        var scheduler = new CommandScheduler('test',{'1': null}).start(client);
        scheduler.intervals.length.should.equal(0);
        scheduler.stop();
        _.defer(function(){
            test.mockredis.snapshot().should.eql([
            ]);
            test.pp.snapshot().should.eql([
                '[scheduler ] start watching: test',
                '[scheduler ] stop watching: test'
            ]);
            done();
        });
    });

    it('should ensure that schedules with empty commands are skipped',function(done){
        var scheduler = new CommandScheduler('test',{'1': '[]'}).start(client);
        scheduler.intervals.length.should.equal(1);
        scheduler.stop();
        _.defer(function(){
            test.mockredis.snapshot().should.eql([
            ]);
            test.pp.snapshot().should.eql([
                '[scheduler ] start watching: test',
                '[scheduler ] schedule[1]: ',
                '[scheduler ] stop watching: test'
            ]);
            done();
        });
    });

    it('should detect an invalid schedule',function(done){
        var scheduler = new CommandScheduler('test',{'1': '{...'}).start(client);
        scheduler.intervals.length.should.equal(0);
        scheduler.stop();
        _.defer(function(){
            test.mockredis.snapshot().should.eql([
            ]);
            test.pp.snapshot().should.eql([
                '[scheduler ] start watching: test',
                '[scheduler ] json error: SyntaxError: Unexpected token .',
                '[scheduler ] stop watching: test'
            ]);
            done();
        });
    });

});