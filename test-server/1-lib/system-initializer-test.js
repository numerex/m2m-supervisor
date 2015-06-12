var _ = require('lodash');
var test = require('../test');

var SystemInitializer = require(process.cwd() + '/lib/system-initializer');

describe('SystemInitializer',function() {

    var mockchecker = {reset: function(){
        mockchecker.events = {};
        mockchecker.exists = {};
        mockchecker.choices = {};
        mockchecker.info = {};
        mockchecker.allPorts = [];
    }};
    function SystemChecker(){
        var self = this;
        self.exists = mockchecker.exists;
        self.info = mockchecker.info;
        self.choices = mockchecker.choices;
        self.allPorts = mockchecker.allPorts;
        self.on = function(event,callback){
            mockchecker.events[event] = callback;
            return self;
        };
        self.checkNow = function(){ return self; };
    }

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('./system-checker',SystemChecker);
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        mockchecker.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('./system-checker');
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect lack of redis',function(done){
        var initializer = new SystemInitializer();
        initializer.initNow(function(error){
            test.pp.snapshot().should.eql([
                '[sys-init  ] unable to configure redis ... please install'
            ]);
            done();
        });
        mockchecker.events.ready();
    });

    it('should detect no settings',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-empty.json';
        mockchecker.exists.redis = true;

        var initializer = new SystemInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.pp.snapshot().should.eql([
                    '[sys-init  ] no private gateway URL',
                    '[sys-init  ] no public gateway URL',
                    '[sys-init  ] no PPP subnet',
                    '[sys-init  ] no IMEI found',
                    '[sys-init  ] no modem serial port found',
                    '[sys-init  ] initialization incomplete'
                ]);
                done();
            });
        });

        mockchecker.events.ready();
    });

    it('should detect bad JSON',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/invalid.json';
        mockchecker.exists.redis = true;

        var initializer = new SystemInitializer();
        initializer.initNow(function(error){
            test.pp.snapshot().should.eql([
                '[sys-init  ] JSON error: Unexpected token .'
            ]);
            done();
        });
    });

    it('should detect no config',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-no-config.json';
        mockchecker.exists.redis = true;

        var initializer = new SystemInitializer();
        initializer.initNow().should.not.be.ok;
        test.pp.snapshot().should.eql([
            '[sys-init  ] incomplete setup file'
        ]);
        done();
    });

    it('should detect minimal settings',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-complete.json';
        mockchecker.exists.redis = true;
        mockchecker.info.imei = '123456789012345';
        mockchecker.choices.controlPort = '/dev/ttyTEST';

        var initializer = new SystemInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0',
                        'gateway:imei': '123456789012345',
                        'modem:port-file': '/dev/ttyTEST'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[sys-init  ] initialization complete'
                ]);
                done();
            });
        });

        mockchecker.events.ready();
    });

    it('should detect maximal settings',function(done){
        process.env.M2M_SUPERVISOR_CONFIG = process.cwd() + '/test-server/data/setup-complete.json';
        mockchecker.exists.redis        = true;
        mockchecker.info.imei           = '123456789012345';
        mockchecker.choices.controlPort = '/dev/ttyTEST';
        mockchecker.info.vendor         = 'vendor';
        mockchecker.info.model          = 'model';
        mockchecker.info.version        = 'version';
        mockchecker.info.imsi           = 'imsi';

        var initializer = new SystemInitializer();
        initializer.initNow(function(error){
            _.defer(function(){
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config',{
                        'gateway:private-url': 'udp:5.6.7.8:3011',
                        'gateway:public-url': 'https://test-server/pistachio',
                        'ppp:subnet': '1.2.3.0',
                        'gateway:imei': '123456789012345',
                        'modem:imsi': 'imsi',
                        'modem:model': 'model',
                        'modem:port-file': '/dev/ttyTEST',
                        'modem:vendor': 'vendor',
                        'modem:version': 'version'
                    }]},
                    {quit: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[sys-init  ] initialization complete'
                ]);
                done();
            });
        });

        mockchecker.events.ready();
    });

});