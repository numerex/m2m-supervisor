var test = require('../test');

var HttpServer = require(process.cwd() + '/services/http-server');

describe('HttpServer',function() {

    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.registerMock('http',test.mockhttp);
        test.mockery.warnOnUnregistered(false);
    });

    after(function () {
        test.mockery.deregisterMock('http');
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
    });

    beforeEach(function () {
        test.mockhttp.reset();
        test.mockredis.reset();
    });

    afterEach(function () {
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should create a server with defaults and ensure error handling',function(done){
        var object = new HttpServer();
        server = object.start('2000');
        server.should.eql(test.mockhttp);
        server.port.should.equal(2000);
        server.events.listening();
        test.expect(function(){ server.events.error('test error'); }).to.throw('test error');
        server.events.error({syscall: 'listen',code: 'EACCES'});
        test.pp.snapshot().should.eql([
            '[http      ] Listening on port 2000',
            '[http      ] unexpected error: test error',
            '[http      ] Port 2000 requires elevated privileges'
        ]);
        done();
    });

    it('should create a server with a named pipe and ensure error handling',function(done){
        test.mockhttp.addressResult = 'test-pipe';
        var object = new HttpServer();
        server = object.start('test');
        server.should.eql(test.mockhttp);
        server.port.should.equal('test');
        server.events.listening();
        server.events.error({syscall: 'listen',code: 'EADDRINUSE'});
        test.pp.snapshot().should.eql([
            '[http      ] Listening on pipe test-pipe',
            '[http      ] Pipe test is already in use'
        ]);
        done();
    });

    it('should create a server with a negative port (why??) and ensure error handling',function(done){
        test.mockhttp.addressResult = null;
        var object = new HttpServer();
        server = object.start(-1000);
        server.should.eql(test.mockhttp);
        server.port.should.equal(false);
        server.events.listening();
        test.expect(function(){ server.events.error({syscall: 'listen',code: 'unknown'}); }).to.throw({syscall: 'listen',code: 'unknown'});
        test.pp.snapshot().should.eql([
            '[http      ] Listening on port 1234',
            '[http      ] unknown error for Port false: [object Object]'
        ]);
        done();
    });

});