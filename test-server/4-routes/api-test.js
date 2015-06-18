var _ = require('lodash');
var test = require('../test');

describe('API Local',function() {
    var app = null;
    var testProxyResult = null;
    var testProxyError = null;
    var testProxyConfig = null;
    var ProxyHelper = function(client,config){
        this.client = client;
        this.config = config;

        this.checkConfig = function(callback){
            callback(testProxyError,testProxyConfig);
        };

        this.get = function(path,res){
            res.send(testProxyResult);
        };

        this.post = function(path,body,res){
            res.send(testProxyResult);
        };
    };


    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('../lib/proxy-helper',ProxyHelper);
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        app = require(process.cwd() + '/app');

        require(process.cwd() + '/routes/api').resetRedisWatcher();
        test.mockredis.snapshot(); // clear
        test.pp.snapshot(); // clear
    });

    after(function () {
        require(process.cwd() + '/routes/api').resetRedisWatcher();
        test.mockredis.snapshot(); // clear
        test.pp.snapshot(); // clear

        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('../lib/proxy-helper');
        test.mockery.disable();
    });

    beforeEach(function () {
        testProxyError = null;
        testProxyConfig = null;
        test.mockredis.reset();
    });

    afterEach(function () {
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    // LOCAL calls...

    it('GET /check should return an empty JSON object',function(done) {
        var request = require('supertest');
        request(app).get('/supervisor/api/check')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({});
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/check HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/check HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    });

    it('GET /proxy detects an error',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;
        testProxyError =  new Error('Test error');

        var request = require('supertest');
        request(app).get('/supervisor/api/proxy')
            .expect(302)
            .end(function(err,res){
                test.should.not.exist(err);
                res.headers.location.should.eql('/');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/proxy HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] proxy error: Test error',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/proxy HTTP\/1\.1 302 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /proxy with no settings',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;

        var request = require('supertest');
        request(app).get('/supervisor/api/proxy')
            .expect(302)
            .end(function(err,res){
                test.should.not.exist(err);
                res.headers.location.should.eql('/');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/proxy HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] set proxy: null',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/proxy HTTP\/1\.1 302 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /proxy with URI',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;

        var request = require('supertest');
        request(app).get('/supervisor/api/proxy?uri=/supervisor')
            .expect(302)
            .end(function(err,res){
                test.should.not.exist(err);
                res.headers.location.should.eql('/supervisor');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/proxy\?uri=%2Fsupervisor HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] set proxy: null',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/proxy\?uri=%2Fsupervisor HTTP\/1\.1 302 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /proxy with no settings',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;

        var request = require('supertest');
        request(app).post('/supervisor/api/proxy')
            .expect(302)
            .end(function(err,res){
                test.should.not.exist(err);
                res.headers.location.should.eql('/');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/proxy HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] set proxy: null',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/proxy HTTP\/1\.1 302 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /config should detect a redis not ready',function(done) {
        test.mockredis.clientException = 'test error';

        var request = require('supertest');
        request(app).get('/supervisor/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({error: 'Redis not ready'});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {end: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] redis client error: test error',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /config should return the current configuration from redis',function(done) {
        var request = require('supertest');
        request(app).get('/supervisor/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"config":\{"Gateway":/);
                // NOTE - drop through to next test to allow existing redisCheck to be used... facilitates test coverage
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-config'}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    });

    it('POST /config should do nothing but return the current configuration when no changes given',function(done) {
        var request = require('supertest');
        request(app).post('/supervisor/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({error: 'No changes requested'});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[api       ] config changes: {}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /config should save changes in redis and return the current configuration',function(done) {
        test.mockredis.lookup.hgetall['m2m-config'] = {'gateway:primary': 'private'};

        var request = require('supertest');
        request(app).post('/supervisor/api/config').send({'gateway:primary':'private'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"config":\{"Gateway":/);
                res.text.should.match(/"value":"private"/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-config','gateway:primary','private']},
                    {hgetall: 'm2m-config'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] .* --> POST \/supervisor\/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] config changes: {"gateway:primary":"private"}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripherals should return the set of peripheral IDs found in redis',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test:settings'];

        var request = require('supertest');
        request(app).get('/supervisor/api/peripherals')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-peripheral:*:settings'},
                    {quit: null}
                ]);
                res.body.should.eql({peripherals:['test']});
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripherals HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripherals HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral should return the default settings for a new peripheral when no peripheral profile exists',function(done){
        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                res.text.should.match(/^\{"new-peripheral":\{"Connection":/);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral should return the default settings for a new peripheral when a peripheral profile exists without a schedule',function(done){
        test.mockredis.lookup.keys['*'] = ['m2m-command:testKey:profile'];
        test.mockredis.lookup.hgetall['m2m-command:testKey:profile'] = {'command:command-prefix': 'TESTPATTERN'};
        //require(process.cwd() + '/routes/api').resetRedisWatcher();

        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-command:testKey:profile'},
                    {quit: null}
                ]);
                res.text.should.match(/^\{"new-peripheral":\{"Connection":/);
                res.text.should.match(/{"key":"command:profile","label":"Profile","type":"string","default":null,"value":"testKey"}/);
                res.text.should.match(/{"key":"command:routing","label":"Routing","options":\["ad-hoc","none"\],"type":"string","status":"editable","default":"ad-hoc"},{"key":"command:schedule","label":"Schedule","type":"string","default":null,"value":null}/);
                res.text.should.match(/{"key":"command:command-prefix","label":"Command Prefix","type":"string","default":null,"value":"TESTPATTERN"}/);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral should return the default settings for a new peripheral when a peripheral profile exists with a schedule',function(done){
        test.mockredis.lookup.keys['*'] = ['m2m-command:testKey:profile','m2m-schedule:testKey:periods'];
        test.mockredis.lookup.hgetall['m2m-command:testKey:profile'] = {'command:command-prefix': 'TESTPATTERN'};
        //require(process.cwd() + '/routes/api').resetRedisWatcher();

        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-command:testKey:profile'},
                    {quit: null}
                ]);
                res.text.should.match(/^\{"new-peripheral":\{"Connection":/);
                res.text.should.match(/{"key":"command:profile","label":"Profile","type":"string","default":null,"value":"testKey"}/);
                res.text.should.match(/{"key":"command:routing","label":"Routing","options":\["ad-hoc","none","scheduled"\],"type":"string","status":"editable","default":"scheduled"},{"key":"command:schedule","label":"Schedule","type":"string","default":null,"value":"testKey"}/);
                res.text.should.match(/{"key":"command:command-prefix","label":"Command Prefix","type":"string","default":null,"value":"TESTPATTERN"}/);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /peripheral should detect a missing peripheral ID',function(done){
        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Peripheral ID not provided"}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /peripheral should detect an existing peripheral ID',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-123:settings'];

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral').send({id: 'test 123'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({error: 'Peripheral ID already used'});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-peripheral:*:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });


    it('POST /peripheral should create a new peripheral',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:other:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral').send({id: 'test abc:123','connection:telnet:address': 'localhost','connection:telnet:port': 10002})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-peripheral:*:settings'},
                    {incr: 'm2m-command:next-route'},
                    {hset: ['m2m-command:routes','1','m2m-peripheral:test-abc-123:queue']},
                    {hmset: ['m2m-peripheral:test-abc-123:settings','connection:telnet:address','localhost','connection:telnet:port','10002']},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] peripheral creation(test-abc-123): {"connection:telnet:address":"localhost","connection:telnet:port":10002}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral/:id should return peripheral settings without a profile or schedule',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral/:id should return peripheral settings with a profile but no schedule',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'command:profile':'test-profile','connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                res.text.should.match(/{"key":"command:profile","label":"Profile","type":"string","default":null,"value":"test-profile","exists":true}/);
                res.text.should.match(/{"key":"command:routing","label":"Routing","options":\["ad-hoc","none"\],"type":"string","status":"editable","default":"ad-hoc"},{"key":"command:schedule","label":"Schedule","type":"string","default":null}/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /peripheral/:id should return peripheral settings with a profile and schedule',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'command:profile':'test-profile','command:schedule':'test-profile','connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).get('/supervisor/api/peripheral/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                res.text.should.match(/{"key":"command:profile","label":"Profile","type":"string","default":null,"value":"test-profile","exists":true}/);
                res.text.should.match(/{"key":"command:routing","label":"Routing","options":\["ad-hoc","none","scheduled"\],"type":"string","status":"editable","default":"ad-hoc"},{"key":"command:schedule","label":"Schedule","type":"string","default":null,"value":"test-profile","exists":true}/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /peripheral/:id should report no changes for empty body',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({error: 'No changes requested'});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] peripheral changes(test-abc-123): {}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /peripheral/:id should update the hash',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral/test-abc-123').send({'connection:telnet:address': 'localhost'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-peripheral:test-abc-123:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] peripheral changes(test-abc-123): {"connection:telnet:address":"localhost"}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });


    it('POST /peripheral/:id should delete from the hash',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral/test-abc-123').send({'connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-peripheral:test-abc-123:settings','connection:telnet:port']},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] peripheral changes(test-abc-123): {"connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /peripheral/:id should allow both updating and deleting from the hash',function(done){
        test.mockredis.lookup.keys['m2m-peripheral:*:settings'] = ['m2m-peripheral:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-peripheral:test-abc-123:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/supervisor/api/peripheral/test-abc-123').send({'connection:telnet:address': 'localhost','connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.match(/^\{"peripheral:test-abc-123":\{"Connection":/);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-peripheral:test-abc-123:settings','connection:telnet:port']},
                    {hmset: ['m2m-peripheral:test-abc-123:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-peripheral:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] peripheral changes(test-abc-123): {"connection:telnet:address":"localhost","connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/supervisor\/api\/peripheral\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /schedules should return the set of schedule IDs found in redis',function(done){
        test.mockredis.lookup.keys['m2m-schedule:*:periods'] = ['m2m-schedule:test:periods'];

        var request = require('supertest');
        request(app).get('/supervisor/api/schedules')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-schedule:*:periods'},
                    {quit: null}
                ]);
                res.body.should.eql({schedules:['test']});
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/schedules HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/schedules HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /schedule/:id should return schedule settings',function(done){
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {"100": '["TEST1","TEST2"]',"200": '["TEST3"]'};

        var request = require('supertest');
        request(app).get('/supervisor/api/schedule/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({'schedule:test':[{period:100,commands:['TEST1','TEST2']},{period:200,commands:['TEST3']}]});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-schedule:test:periods'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/schedule\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/schedule\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /profile/:id should return a peripheral profile',function(done){
        test.mockredis.lookup.hgetall['m2m-command:test:profile'] = {'command:command-prefix':'ABC'};

        var request = require('supertest');
        request(app).get('/supervisor/api/profile/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({'profile:test':{'command:command-prefix':'ABC'}});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-command:test:profile'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/profile\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/profile\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /options/:id should return profile options',function(done){
        test.mockredis.lookup.hgetall['m2m-command:test:options'] = {test: '["X"]'};

        var request = require('supertest');
        request(app).get('/supervisor/api/options/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({'options:test':{test:'["X"]'}});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-command:test:options'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/options\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/options\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /definitions/:id should return profile definitions',function(done){
        test.mockredis.lookup.hgetall['m2m-command:test:definitions'] = {test: '["X"]'};

        var request = require('supertest');
        request(app).get('/supervisor/api/definitions/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({'definitions:test':{test: '["X"]'}});
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-command:test:definitions'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/definitions\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/definitions\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /status should return the status of all services',function(done) {
        var request = require('supertest');
        request(app).get('/supervisor/api/status')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({'redis':true});
                //require(process.cwd() + '/routes/api').resetRedisWatcher(); NOTE -- allow client to carry into PROXY calls...
                test.mockredis.snapshot().should.eql([
                    {keys: '*'}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/supervisor\/api\/status HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/supervisor\/api\/status HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/
                ]);
                done();
            });
    });

    // PROXY calls...

    testProxyGET('config');
    testProxyPOST('config');
    testProxyGET('peripherals');
    testProxyGET('peripheral');
    testProxyPOST('peripheral');
    testProxyGET('peripheral/test');
    testProxyPOST('peripheral/test');
    testProxyGET('status');

    function testProxyGET(api){
        it('GET /' + api + ' with proxy',function(done) {
            var supertest = require('supertest');
            testProxyRequest(supertest(app).get('/supervisor/api/' + api),done);
        });
    }

    function testProxyPOST(api){
        it('POST /' + api + ' with proxy',function(done) {

            var supertest = require('supertest');
            testProxyRequest(supertest(app).post('/supervisor/api/' + api),done);
        });
    }

    function testProxyRequest(request,done){
        testProxyResult = {test: 'TEST'};

        test.setTestSession(request,{hostname:'test'});
        request
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.body.should.eql({test: 'TEST'});
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> \w+ \/supervisor\/api\/\S+ HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    /^\[express   \] \S+ <-- \w+ \/supervisor\/api\/\S+ HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/
                ]);
                done();
            });
    }

});
