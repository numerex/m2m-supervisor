var _ = require('lodash');
var test = require('../test');
var M2mSupervisor = require(process.cwd() + '/processes/m2m-supervisor');

describe('M2mSupervisor',function() {

    var mockdgram = null;
    var mockRoute = require(process.cwd() + '/test-server/mocks/route-test');
    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');
    var testGateway = Object.freeze(helpers.hash2config({'gateway:imei': '123456789012345'}, hashkeys.gateway));

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('dgram', mockdgram = new test.mockdgram());
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('dgram');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        mockRoute.snapshot().should.eql([]);
    });

    it('should start/stop with no services available',function(done){
        test.mockredis.clientException = 'test error';

        var supervisor = new M2mSupervisor().start();
        _.defer(function(){
            supervisor.stop();
            test.pp.snapshot().should.eql([
                '[redis     ] instance created',
                '[socket    ] register behavior: shell',
                '[redis     ] start watching',
                '[http      ] Listening on port 3000',
                '[redis     ] check ready',
                '[redis     ] redis client error: test error',
                '[redis     ] stop watching'
            ]);
            test.mockredis.snapshot().should.eql([
                {keys: '*'},
                {end: null}
            ]);
            mockRoute.snapshot().should.eql([]);
            done();
        });
    });
});