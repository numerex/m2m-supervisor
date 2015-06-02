var _ = require('lodash');
var test = require('../test');

var M2mSupervisor = require(process.cwd() + '/processes/m2m-supervisor');

describe('index router',function() {

    var app = null;
    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        app = require(process.cwd() + '/app');
    });

    after(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
    });

    beforeEach(function () {
        test.mockredis.reset();
        M2mSupervisor.instance = {};

    });

    afterEach(function () {
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
        M2mSupervisor.instance = null;
    });

    it('should return the index page content for a standard M2M Supervisor',function(done){
        var request = require('supertest');
        request(app).get('/')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/ HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/ HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                new RegExp(_.escapeRegExp('<title>M2M Supervisor</title>')).test(res.text).should.be.ok;
                done();
            });
    });

    it('should return the index page content for an M2M Proxy without a proxy session',function(done){
        M2mSupervisor.instance.supervisorProxy = true;

        var request = require('supertest');
        request(app).get('/')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/ HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/ HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                new RegExp(_.escapeRegExp('<title>M2M Proxy</title>')).test(res.text).should.be.ok;
                done();
            });
    });

    it('should return the index page content for an M2M Proxy with a proxy session but no label',function(done){
        M2mSupervisor.instance.supervisorProxy = true;

        var supertest = require('supertest');
        var request = supertest(app).get('/');
        test.setTestSession(request,{hostname:'test'});
        request
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/ HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/ HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                new RegExp(_.escapeRegExp('<title>M2M Remote</title>')).test(res.text).should.be.ok;
                done();
            });
    });

    it('should return the index page content for an M2M Proxy: TEST with a proxy session and TEST label',function(done){
        M2mSupervisor.instance.supervisorProxy = true;

        var supertest = require('supertest');
        var request = supertest(app).get('/');
        test.setTestSession(request,{hostname:'test',label:'TEST'});
        request
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/ HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/ HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                new RegExp(_.escapeRegExp('<title>M2M Remote: TEST</title>')).test(res.text).should.be.ok;
                done();
            });
    });

    it('should return the home page content',function(done){
        var request = require('supertest');
        request(app).get('/supervisor/partials/home')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/supervisor\/partials\/home HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/supervisor\/partials\/home HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    });

});