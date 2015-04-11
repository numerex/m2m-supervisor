var test = require('../test');

describe('index router',function() {

    it('should return the index page content',function(done){
        var request = require('supertest');
        var app = require(process.cwd() + '/app');
        request(app).get('/')
            .expect('Content-Type',/html/)
            .expect(200)
            .end(function (err,res) {
                test.should.not.exist(err);
                done();
            });
    });

});