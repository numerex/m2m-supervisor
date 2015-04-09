var test = require('../test');

describe('StatsdClient',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('lynx', test.mocklynx);
        test.mockery.warnOnUnregistered(false);
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('lynx');
        test.mockery.disable();
    });


    it('should catch a lynx error',function(){
        var client = require(process.cwd() + '/lib/statsd-client')('test');
        test.mocklynx.options.on_error('test error');

        test.expect(test.mocklynx.options).to.exist;
        test.expect(test.mocklynx.options.on_error).to.exist;
        test.pp.snapshot().should.eql(['[lynx      ] lynx error(test): test error']);
    });

});