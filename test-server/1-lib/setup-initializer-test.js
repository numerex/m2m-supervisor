var _ = require('lodash');
var test = require('../test');

var setup = require(process.cwd() + '/lib/global-setup');

var SetupInitializer = require(process.cwd() + '/lib/setup-initializer');

describe('SetupInitializer',function() {

    var ftpSetupFile = null;
    function FtpSetup(name){
        this.setupNow = function(callback){
            if (ftpSetupFile) process.env.M2M_SUPERVISOR_CONFIG = ftpSetupFile;
            callback(null);
        };
    }

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('./ftp-setup',FtpSetup);
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();

        ftpSetupFile = null;
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-empty.json';
        setup.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('./ftp-setup');
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect no settings',function(done){
        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.pp.snapshot().should.eql([
                    '[setup-init] no private gateway URL',
                    '[setup-init] no public gateway URL',
                    '[setup-init] no PPP subnet',
                    '[setup-init] initialization incomplete'
                ]);
                done();
            });
        });
    });

    it('should detect bad JSON',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/invalid.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            test.pp.snapshot().should.eql([
                '[setup-init] setup error: Unexpected token .',
                '[setup-init] initialization incomplete'
            ]);
            done();
        });
    });

    it('should detect no config',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-no-config.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            test.pp.snapshot().should.eql([
                '[setup-init] no private gateway URL',
                '[setup-init] no public gateway URL',
                '[setup-init] no PPP subnet',
                '[setup-init] initialization incomplete'
            ]);
            done();
        });
    });

    it('should detect minimal settings',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-complete.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[setup-init] initialization complete'
                ]);
                done();
            });
        });
    });

    it('should detect FTP failure',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-complete.json';
        setup.reset();

        ftpSetupFile = process.cwd() + '/test-server/data/invalid.json';

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.pp.snapshot().should.eql([
                    '[setup-init] setup error: Unexpected token .',
                    '[setup-init] initialization incomplete'
                ]);
                done();
            });
        });
    });

    it('should detect maximal settings',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-complete.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[setup-init] initialization complete'
                ]);
                done();
            });
        });
    });

    it('should run good script',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-with-good-script.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[setup-init] run: test-server/data/good.sh test',
                    '[setup-init] result: 0',
                    '[setup-init] initialization complete'
                ]);
                done();
            });
        });
    });

    it('should detect bad script',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-with-bad-script.json';
        setup.reset();

        var initializer = new SetupInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[setup-init] run: bad.sh test',
                    '[setup-init] result: 127',
                    '[setup-init] initialization incomplete'
                ]);
                done();
            });
        });
    });

});