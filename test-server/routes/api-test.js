var test = require('../test');

describe('API router',function() {
    var app = null;

    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        app = require(process.cwd() + '/app');
    });

    after(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
    });

    beforeEach(function () {
        test.mockredis.reset();
    });

    afterEach(function () {
    });

    it('GET /config should detect a redis error',function(done) {
        test.mockredis.errors['m2m-config'] = 'test error';
        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"redis error: test error"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-config'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] ::ffff:127.0.0.1 <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /config should return the current configuration from redis',function(done) {
        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"config":[{"key":"gateway:imei","group":"Gateway","value":null,"label":"IMEI","type":"string","default":null,"status":"locked"},{"key":"gateway:private-host","group":"Gateway","value":"172.29.12.253","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","group":"Gateway","value":3011,"label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","group":"Gateway","value":"192.119.183.253","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","group":"Gateway","value":3011,"label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","group":"Gateway","value":4000,"label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","group":"Gateway","value":4001,"label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","group":"Gateway","value":"public","label":"Primary Route","options":["public","private"],"type":"string","default":"public"},{"key":"custom:web-route","group":"Custom","label":"Web Routes","type":"string"},{"key":"custom:command-module","group":"Custom","label":"Command Module","type":"string"},{"key":"custom:extension-module","group":"Custom","label":"Extension Module","type":"string"}]}');
                // NOTE - drop through to next test to allow existing redisCheck to be used... facilitates test coverage
                test.mockredis.snapshot().should.eql([{hgetall: 'm2m-config'}]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] ::ffff:127.0.0.1 <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    });

    it('POST /config should do nothing but return the current configuration when no changes given',function(done) {
        var request = require('supertest');
        request(app).post('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"No changes requested"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([{quit: null}]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[api       ] config changes: {}',
                    /^\[express   \] ::ffff:127.0.0.1 <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /config should save changes in redis and return the current configuration',function(done) {
        var request = require('supertest');
        request(app).post('/api/config').send({'gateway:primary':'private'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"config":[{"key":"gateway:imei","group":"Gateway","value":null,"label":"IMEI","type":"string","default":null,"status":"locked"},{"key":"gateway:private-host","group":"Gateway","value":"172.29.12.253","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","group":"Gateway","value":3011,"label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","group":"Gateway","value":"192.119.183.253","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","group":"Gateway","value":3011,"label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","group":"Gateway","value":4000,"label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","group":"Gateway","value":4001,"label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","group":"Gateway","value":"public","label":"Primary Route","options":["public","private"],"type":"string","default":"public"},{"key":"custom:web-route","group":"Custom","label":"Web Routes","type":"string"},{"key":"custom:command-module","group":"Custom","label":"Command Module","type":"string"},{"key":"custom:extension-module","group":"Custom","label":"Extension Module","type":"string"}]}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {hmset: ['m2m-config','gateway:primary','private']},
                    {hgetall: 'm2m-config'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] config changes: {"gateway:primary":"private"}',
                    /^\[express   \] ::ffff:127.0.0.1 <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /status should return the status of all services',function(done) {
        var request = require('supertest');
        request(app).get('/api/status')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"redis":true,"ethernet":true,"ppp":true,"cpu":true,"memory":true,"disk":true,"logic":true}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([{quit: null}]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> GET \/api\/status HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] ::ffff:127.0.0.1 <-- GET \/api\/status HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /config should detect that redis is not ready',function(done) {
        test.mockredis.clientException = 'test error';
        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Redis not ready"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] ::ffff:127\.0\.0\.1 --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[redis-chk ] not ready: Error: test error',
                    /^\[express   \] ::ffff:127.0.0.1 <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

});