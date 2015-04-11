var test = require('../test');

describe('app',function() {

    var app = require(process.cwd() + '/app');

    it('should return 404 for missing route',function(done){
        var request = require('supertest');
        request(app).get('/missing')
            .expect('Content-Type',/html/)
            .expect(404)
            .end(function (err,res) {
                test.should.not.exist(err);
                done();
            });
    });

    it('should handle partials',function(done){
        var request = require('supertest');
        request(app).get('/partials/home.jade')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                done();
            });
    })

});
