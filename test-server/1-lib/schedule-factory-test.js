var fs = require('fs');

var test = require('../test');

var ScheduleFactory = require(process.cwd() + '/lib/schedule-factory');

describe('ScheduleFactory',function() {

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

    it('should load a valid file', function (done) {
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {result: 'OK'};

        var factory = new ScheduleFactory(client);
        factory.loadSchedulesFile('test','test-server/data/example-schedule.json',function(result){
            result.should.eql({result: 'OK'});
            test.mockredis.snapshot().should.eql([
                {del: 'm2m-schedule:test:periods'},
                {hmset: ['m2m-schedule:test:periods',
                    600,'["i20100","i20200","i20700","i20B00","i21200","i30100","i30600","i31500","i34100","i34600","i35100","i37300","i38800","i40100","iB7E00","iB7F00","i&1400"]',
                    240,'["i@5500"]',
                    60,'["i11300","i11400","i&1200"]',
                    45,'["i@C300"]'
                ]},
                {hgetall: 'm2m-schedule:test:periods'}
            ]);
            done();
        });
    });

    it('should detect an invalid file', function (done) {
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {result: 'OK'};

        var factory = new ScheduleFactory(client);
        factory.loadSchedulesFile('test','unknown.file',function(result){
            [result].should.eql([null]);
            test.pp.snapshot().should.eql(['[sch-fact  ] load error: Error: ENOENT, no such file or directory \'unknown.file\'']);
            done();
        });
    });

    it('should detect an invalid json', function (done) {
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {result: 'OK'};

        var factory = new ScheduleFactory(client);
        factory.loadSchedulesFile('test','test-server/data/invalid.json',function(result){
            [result].should.eql([null]);
            test.pp.snapshot().should.eql(['[sch-fact  ] load error: SyntaxError: Unexpected token .']);
            done();
        });
    });

    it('should allow an empty schedule to delete a hash',function(done){
        var factory = new ScheduleFactory(client);
        factory.loadSchedules('test',[],function(result){
            [result].should.eql([null]);
            test.mockredis.snapshot().should.eql([
                {del: 'm2m-schedule:test:periods'},
                {hgetall: 'm2m-schedule:test:periods'}
            ]);
            done();
        });
    });

    it('should export an empty schedule',function(done){
        var factory = new ScheduleFactory(client).exportSchedules('test',function(schedules){
            schedules.should.eql([]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-schedule:test:periods'}
            ]);
            done();
        });
    });

    it('should export a schedule',function(done){
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {"100": '["TEST1","TEST2"]',"200": '["TEST3"]'};

        var factory = new ScheduleFactory(client).exportSchedules('test',function(schedules){
            schedules.should.eql([
                {period: 100,commands: ['TEST1','TEST2']},
                {period: 200,commands: ['TEST3']}
            ]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-schedule:test:periods'}
            ]);
            done();
        });
    });

    it('should export a schedule as JSON to a file',function(done){
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {"100": '["TEST1","TEST2"]',"200": '["TEST3"]'};

        var factory = new ScheduleFactory(client).exportSchedulesFile('test','tmp/test-schedule.json',function(){
            var json = fs.readFileSync('tmp/test-schedule.json').toString();
            json.should.eql('[{"period":100,"commands":["TEST1","TEST2"]},{"period":200,"commands":["TEST3"]}]');
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-schedule:test:periods'}
            ]);
            done();
        });
    });

});