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

    it('GET /config should detect a redis not ready',function(done) {
        test.mockredis.clientException = 'test error';

        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Redis not ready"}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {end: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] redis client error: test error',
                    /^\[express   \] \S+ <-- GET \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    var DEFAULT_CONFIG_JSON = '{"config":{"Gateway":[{"key":"gateway:imei","label":"IMEI","type":"string","default":null,"required":true,"status":"locked"},{"key":"gateway:private-host","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","label":"Primary Route","options":["public","private"],"type":"string","default":"public"},{"key":"gateway:heartbeat-interval","label":"Heartbeat Interval","type":"number","default":3600000}],"PPP":[{"key":"ppp:interface","label":"PPP Interface","type":"string","default":"ppp0"},{"key":"ppp:subnet","label":"PPP Subnet","type":"string","default":"172.29.12.0"},{"key":"ppp:mask","label":"PPP Mask","type":"string","default":"255.255.255.0"},{"key":"ppp:route-interval","label":"Route Check Interval","type":"number","default":60000}],"Modem":[{"key":"modem:port-file","label":"Port File","type":"string","default":"/dev/ttyUSB2","required":true},{"key":"modem:baud-rate","label":"Baud Rate","type":"number","default":460800,"required":true},{"key":"modem:rssi-interval","label":"RSSI Report Interval","type":"number","default":60000}]}}';

    it('GET /config should return the current configuration from redis',function(done) {
        var request = require('supertest');
        request(app).get('/api/config')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(DEFAULT_CONFIG_JSON);
                // NOTE - drop through to next test to allow existing redisCheck to be used... facilitates test coverage
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-config'}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
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
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[api       ] config changes: {}',
                    /^\[express   \] \S+ <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    var CONFIG_PRIMARY_PRIVATE_JSON = '{"config":{"Gateway":[{"key":"gateway:imei","label":"IMEI","type":"string","default":null,"required":true,"status":"locked"},{"key":"gateway:private-host","label":"Private Host","type":"string","default":"172.29.12.253"},{"key":"gateway:private-port","label":"Private Port","type":"number","default":3011},{"key":"gateway:public-host","label":"Public Host","type":"string","default":"192.119.183.253"},{"key":"gateway:public-port","label":"Public Port","type":"number","default":3011},{"key":"gateway:private-relay","label":"Private Relay Port","type":"number","default":4000},{"key":"gateway:public-relay","label":"Public Relay Port","type":"number","default":4001},{"key":"gateway:primary","label":"Primary Route","options":["public","private"],"type":"string","default":"public"},{"key":"gateway:heartbeat-interval","label":"Heartbeat Interval","type":"number","default":3600000}],"PPP":[{"key":"ppp:interface","label":"PPP Interface","type":"string","default":"ppp0"},{"key":"ppp:subnet","label":"PPP Subnet","type":"string","default":"172.29.12.0"},{"key":"ppp:mask","label":"PPP Mask","type":"string","default":"255.255.255.0"},{"key":"ppp:route-interval","label":"Route Check Interval","type":"number","default":60000}],"Modem":[{"key":"modem:port-file","label":"Port File","type":"string","default":"/dev/ttyUSB2","required":true},{"key":"modem:baud-rate","label":"Baud Rate","type":"number","default":460800,"required":true},{"key":"modem:rssi-interval","label":"RSSI Report Interval","type":"number","default":60000}]}}';

    it('POST /config should save changes in redis and return the current configuration',function(done) {
        var request = require('supertest');
        request(app).post('/api/config').send({'gateway:primary':'private'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(CONFIG_PRIMARY_PRIVATE_JSON);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-config','gateway:primary','private']},
                    {hgetall: 'm2m-config'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] .* --> POST \/api\/config HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] config changes: {"gateway:primary":"private"}',
                    /^\[express   \] \S+ <-- POST \/api\/config HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.0 \d+\.\d+ ms/,
                    '[redis     ] stop watching'
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
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {quit: null}
                ]);
                res.text.should.eql('{"devices":["test"]}');
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/devices HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/devices HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    var NEW_DEVICE_TEMPLATE_JSON = '{"new-device":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["ad-hoc","scheduled","none"],"type":"string","default":"ad-hoc"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}';

    it('GET /device should return the default settings for a new device',function(done){
        var request = require('supertest');
        request(app).get('/api/device')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                res.text.should.eql(NEW_DEVICE_TEMPLATE_JSON);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
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
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /device should detect an existing device ID',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-123:settings'];

        var request = require('supertest');
        request(app).post('/api/device').send({id: 'test 123'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"Device ID already used"}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    var NEW_DEVICE_WITH_ADDRESS_AND_PORT_JSON = '{"device:test-abc-123":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true,"value":10002,"exists":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["ad-hoc","scheduled","none"],"type":"string","default":"ad-hoc"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}';

    it('POST /device should create a new device',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:other:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/api/device').send({id: 'test abc:123','connection:telnet:address': 'localhost','connection:telnet:port': 10002})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(NEW_DEVICE_WITH_ADDRESS_AND_PORT_JSON);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {keys: 'm2m-device:*:settings'},
                    {hmset: ['m2m-device:test-abc-123:settings','connection:telnet:address','localhost','connection:telnet:port',10002]},
                    {hgetall: 'm2m-device:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] device creation(test-abc-123): {"connection:telnet:address":"localhost","connection:telnet:port":10002}',
                    /^\[express   \] \S+ <-- POST \/api\/device HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /device/:id should return device settings',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).get('/api/device/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(NEW_DEVICE_WITH_ADDRESS_AND_PORT_JSON);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-device:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/device\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/device\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /device/:id should report no changes for empty body',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/api/device/test-abc-123')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"error":"No changes requested"}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] device changes(test-abc-123): {}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /device/:id should update the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost','connection:telnet:port': '10002'};

        var request = require('supertest');
        request(app).post('/api/device/test-abc-123').send({'connection:telnet:address': 'localhost'})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(NEW_DEVICE_WITH_ADDRESS_AND_PORT_JSON);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hmset: ['m2m-device:test-abc-123:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-device:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] device changes(test-abc-123): {"connection:telnet:address":"localhost"}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    var NEW_DEVICE_WITHOUT_PORT = '{"device:test-abc-123":{"Connection":[{"key":"connection:type","label":"Type","options":["telnet","serial"],"type":"string","default":"telnet","required":true},{"key":"connection:telnet:address","label":"Telnet Address","type":"string","default":null,"required":true,"value":"localhost","exists":true},{"key":"connection:telnet:port","label":"Telnet Port","type":"number","default":10001,"required":true},{"key":"connection:serial:port","label":"Serial Port","type":"string","default":"/dev/tty0","required":true},{"key":"connection:serial:baud-rate","label":"Serial Baud Rate","type":"number","default":9600,"required":true}],"Route":[{"key":"route:type","label":"Type","options":["ad-hoc","scheduled","none"],"type":"string","default":"ad-hoc"},{"key":"route:schedule","label":"Schedule","type":"string","default":null}]}}';

    it('POST /device/:id should delete from the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/api/device/test-abc-123').send({'connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(NEW_DEVICE_WITHOUT_PORT);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-device:test-abc-123:settings','connection:telnet:port']},
                    {hgetall: 'm2m-device:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] device changes(test-abc-123): {"connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('POST /device/:id should allow both updating and deleting from the hash',function(done){
        test.mockredis.lookup.keys['m2m-device:*:settings'] = ['m2m-device:test-abc-123:settings'];
        test.mockredis.lookup.hgetall['m2m-device:test-abc-123:settings'] = {'connection:telnet:address': 'localhost'};

        var request = require('supertest');
        request(app).post('/api/device/test-abc-123').send({'connection:telnet:address': 'localhost','connection:telnet:port': null})
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql(NEW_DEVICE_WITHOUT_PORT);
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hdel: ['m2m-device:test-abc-123:settings','connection:telnet:port']},
                    {hmset: ['m2m-device:test-abc-123:settings','connection:telnet:address','localhost']},
                    {hgetall: 'm2m-device:test-abc-123:settings'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    '[api       ] device changes(test-abc-123): {"connection:telnet:address":"localhost","connection:telnet:port":null}',
                    /^\[express   \] \S+ <-- POST \/api\/device\/test-abc-123 HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /schedules should return the set of schedule IDs found in redis',function(done){
        test.mockredis.lookup.keys['m2m-schedule:*:periods'] = ['m2m-schedule:test:periods'];

        var request = require('supertest');
        request(app).get('/api/schedules')
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
                res.text.should.eql('{"schedules":["test"]}');
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/schedules HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/schedules HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

    it('GET /schedule/:id should return schedule settings',function(done){
        test.mockredis.lookup.keys['m2m-schedule:*:settings'] = ['m2m-schedule:test:settings'];
        test.mockredis.lookup.hgetall['m2m-schedule:test:periods'] = {"100": '["TEST1","TEST2"]',"200": '["TEST3"]'};

        var request = require('supertest');
        request(app).get('/api/schedule/test')
            .expect('Content-Type',/json/)
            .expect(200)
            .end(function(err,res){
                test.should.not.exist(err);
                res.text.should.eql('{"schedule:test":[{"period":100,"commands":["TEST1","TEST2"]},{"period":200,"commands":["TEST3"]}]}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {hgetall: 'm2m-schedule:test:periods'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/schedule\/test HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/schedule\/test HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
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
                res.text.should.eql('{"redis":true}');
                require(process.cwd() + '/routes/api').resetRedisWatcher();
                test.mockredis.snapshot().should.eql([
                    {keys: '*'},
                    {quit: null}
                ]);
                test.matchArrays(test.pp.snapshot(),[
                    /^\[express   \] \S+ --> GET \/api\/status HTTP\/1\.1 200 - - Other 0.0 Other 0.0.0 \d+\.\d+ ms/,
                    '[redis     ] instance created',
                    '[redis     ] start watching',
                    '[redis     ] check ready',
                    '[redis     ] now ready',
                    /^\[express   \] \S+ <-- GET \/api\/status HTTP\/1\.1 200 \d+ - Other 0\.0 Other 0\.0\.\d+ \d+\.\d+ ms/,
                    '[redis     ] stop watching'
                ]);
                done();
            });
    });

});
