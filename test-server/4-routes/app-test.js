var test = require('../test');

describe('app',function() {

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
    });

    afterEach(function () {
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should return 404 for missing route',function(done){
        var request = require('supertest');
        request(app).get('/missing')
            .expect('Content-Type',/html/)
            .expect(404)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/missing HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[express   ] error(404): Not Found: /missing',
                    /\[express   \] \S+ <-- GET \/missing HTTP\/1\.1 404 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    });

    it('should handle partials',function(done){
        var request = require('supertest');
        request(app).get('/supervisor/partials/home.jade')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                test.matchArrays(test.pp.snapshot(),[
                    /\[express   \] \S+ --> GET \/supervisor\/partials\/home\.jade HTTP\/1\.1 200 - - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    /\[express   \] \S+ <-- GET \/supervisor\/partials\/home\.jade HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    })

});
