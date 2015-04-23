var test = require('../test');

describe('API router',function() {
    var app = null;

    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
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
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('GET /config should detect a redis not ready',function(done) {
        test.mockredis.clientException = 'test error';
        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Redis not ready"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[redis-chk ] redis client error: test error',
                    /^\[express   \] \S+ <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
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
                res.text.should.eql('{"config":{"Gateway":[{"key":"gateway:imei","label":"IMEI","type":"string","default":null,"required":true,"status":"locked"},{"key":"gateway:private-host","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","label":"Primary Route","options":["public","private"],"type":"string","default":"public"}],"Custom":[{"key":"custom:web-route","label":"Web Routes","type":"string"},{"key":"custom:command-module","label":"Command Module","type":"string"},{"key":"custom:extension-module","label":"Extension Module","type":"string"}]}}');
                // NOTE - drop through to next test to allow existing redisCheck to be used... facilitates test coverage
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-config'}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
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
                test.mockredis.snapshot().should.eql([
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[api       ] config changes: {}',
                    /^\[express   \] \S+ <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
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
                res.text.should.eql('{"config":{"Gateway":[{"key":"gateway:imei","label":"IMEI","type":"string","default":null,"required":true,"status":"locked"},{"key":"gateway:private-host","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","label":"Primary Route","options":["public","private"],"type":"string","default":"public"}],"Custom":[{"key":"custom:web-route","label":"Web Routes","type":"string"},{"key":"custom:command-module","label":"Command Module","type":"string"},{"key":"custom:extension-module","label":"Extension Module","type":"string"}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-config','gateway:primary','private']},
                    {hgetall: 'm2m-config'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] .* --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] config changes: {"gateway:primary":"private"}',
                    /^\[express   \] \S+ <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /devices should return the set of device IDs found in redis',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];

        var request = require('supertest');
        request(app).get('/api/devices')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {quit: null}
                ]);
                res.text.should.eql('["test"]');
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/devices HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- GET \/api\/devices HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /device should return the default settings for a new device',function(done){
        var request = require('supertest');
        request(app).get('/api/device')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                test.mockredis.snapshot().should.eql([]);
                res.text.should.eql('{"new-device":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    /^\[express   \] \S+ <-- GET \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/
                ]);
                done();
            });
    });

    it('POST /device should detect a missing device ID',function(done){
        var request = require('supertest');
        request(app).post('/api/device')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Device ID not provided"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device should detect an existing device ID',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];

        var request = require('supertest');
        request(app).post('/api/device').send({id: 'test'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Device ID already used"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device should create a new device',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:other:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/api/device').send({id: 'test','connection:telnet:address': 'localhost','connection:telnet:port': 10002})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true,"value":10002,"exists":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {hmset: ['m2m-device:test:settings','connection:telnet:address','localhost','connection:telnet:port',10002]},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] device creation(test): {"connection:telnet:address":"localhost","connection:telnet:port":10002}',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /device/:id for a non-existent device should return an error',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:other:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).get('/api/device/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- GET \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('GET /device/:id should return device settings',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:other:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).get('/api/device/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- GET \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device/:id should report no changes for empty body',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/api/device/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"No changes requested"}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] device changes(test): {}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device/:id should update the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/api/device/test').send({'connection:telnet:address': 'localhost'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-device:test:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] device changes(test): {"connection:telnet:address":"localhost"}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device/:id should delete from the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {};

        var request = require('supertest');
        request(app).post('/api/device/test').send({'connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-device:test:settings','connection:telnet:port']},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] device changes(test): {"connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

    it('POST /device/:id should allow both updating and deleting from the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/api/device/test').send({'connection:telnet:address': 'localhost','connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"device:test":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["none","ad-hoc","scheduled"],"type":"string","default":"none"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}');
                require(process.cwd() + '/routes/api').resetRedisChk();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-device:test:settings','connection:telnet:port']},
                    {hmset: ['m2m-device:test:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-device:test:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    '[api       ] device changes(test): {"connection:telnet:address":"localhost","connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
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
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/status HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis-chk ] start checkpoint',
                    /^\[express   \] \S+ <-- GET \/api\/status HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis-chk ] stop checkpoint'
                ]);
                done();
            });
    });

});
