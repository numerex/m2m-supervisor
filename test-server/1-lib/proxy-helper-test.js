var _ = require('lodash');

var test = require('../test');

var ProxyHelper = require(process.cwd() + '/lib/proxy-helper');

describe('ProxyHelper',function() {
    var client = null;

    before(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.registerMock('https',test.mockhttps);
        test.mockery.registerMock('http',test.mockhttp);
        test.mockery.warnOnUnregistered(false);
    });

    after(function () {
        test.mockery.deregisterMock('http');
        test.mockery.deregisterMock('https');
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
    });

    beforeEach(function () {
        test.mockhttp.reset();
        test.mockhttps.reset();
        test.mockredis.reset();
        client = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect no session given with a proxyPeer',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = 'peer-host';

        new ProxyHelper(client,{}).checkConfig(function(error,config){
            error.should.eql(new Error('No session given'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql([]);
            test.mockhttp.written.should.eql([]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should detect invalid proxyPeer via statusCode',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = 'peer-host';
        test.mockhttps.statusCode = 500;
        test.mockhttps.statusMessage = 'Unknown host';

        new ProxyHelper(client,{session: 'test'}).checkConfig(function(error,config){
            error.should.eql(new Error('Unknown host'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql(['session=test',null]);
            test.mockhttp.written.should.eql([]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should detect invalid proxyPeer via requestError',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = 'peer-host';
        test.mockhttps.requestError = 'Unknown host';

        new ProxyHelper(client,{session: 'test'}).checkConfig(function(error,config){
            error.should.eql(new Error('Unknown host'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql(['session=test',new Error('Unknown host')]);
            test.mockhttp.written.should.eql([]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            test.pp.snapshot().should.eql(['[proxy-help] check proxy error: Unknown host']);
            done();
        });
    });

    it('should detect no proxy given with no proxyPeer',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;

        new ProxyHelper(client,{}).checkConfig(function(error,config){
            _.isNull(error).should.be.ok;
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql([]);
            test.mockhttp.written.should.eql([null]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should detect unknown proxy with no proxyPeer via statusCode',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;
        test.mockhttp.statusCode = 500;
        test.mockhttp.statusMessage = 'Unknown host';

        new ProxyHelper(client,{}).checkConfig(function(error,config){
            error.should.eql(new Error('Unknown host'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql([]);
            test.mockhttp.written.should.eql([null]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should detect unknown proxy with no proxyPeer via requestError',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;
        test.mockhttp.requestError = 'Unknown host';

        new ProxyHelper(client,{}).checkConfig(function(error,config){
            error.should.eql(new Error('Unknown host'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql([]);
            test.mockhttp.written.should.eql([new Error('Unknown host')]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            test.pp.snapshot().should.eql(['[proxy-help] check host error: Unknown host']);
            done();
        });
    });

    it('should detect unknown proxy with a proxyPeer via statusCode',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = 'peer-host';
        test.mockhttp.statusCode = 500;
        test.mockhttp.statusMessage = 'Unknown host';

        new ProxyHelper(client,{session: 'test'}).checkConfig(function(error,config){
            error.should.eql(new Error('Unknown host'));
            _.isNull(config).should.be.ok;
            test.mockhttps.written.should.eql(['session=test',null]);
            test.mockhttp.written.should.eql([null]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should accept a valid configuration',function(done){
        test.mockredis.lookup.get['m2m-proxy-peer'] = null;

        new ProxyHelper(client,{session: 'test',hostname: 'valid-host',label: 'host-label'}).checkConfig(function(error,config){
            _.isNull(error).should.be.ok;
            config.should.eql({hostname: 'valid-host',label: 'host-label'});
            test.mockhttps.written.should.eql([]);
            test.mockhttp.written.should.eql([null]);
            test.mockredis.snapshot().should.eql([
                {get: 'm2m-proxy-peer'}
            ]);
            done();
        });
    });

    it('should detect a failed request via statusCode',function(){
        test.mockhttp.statusCode = 500;
        test.mockhttp.statusMessage = 'Unknown error';

        new ProxyHelper(client,{hostname: 'valid-host'}).get('/test',test.mockhttp);

        test.mockhttp.written.should.eql([null,{send: {error: 'Error: 500 Unknown error'}}]);
        test.mockhttp.lastOptions.should.eql({
            hostname: 'valid-host',
            method: 'GET',
            path: '/supervisor/api/test',
            port: 5000});
    });

    it('should detect a failed request via requestError',function(){
        test.mockhttp.requestError = 'Unknown error';

        new ProxyHelper(client,{hostname: 'valid-host'}).get('/test',test.mockhttp);

        test.mockhttp.written.should.eql([new Error('Unknown error'),{send: {error: 'Unknown error'}}]);
        test.mockhttp.lastOptions.should.eql({
            hostname: 'valid-host',
            method: 'GET',
            path: '/supervisor/api/test',
            port: 5000});
        test.pp.snapshot().should.eql(['[proxy-help] request error: Unknown error']);
    });

    it('should perform a successful GET',function(){
        test.mockhttp.headers['content-length'] = 10;

        new ProxyHelper(client,{hostname: 'valid-host'}).get('/test',test.mockhttp);

        (!!test.mockhttp.events.data).should.be.ok;
        test.mockhttp.events.data('1234567890');

        test.mockhttp.written.should.eql([null,{send: '1234567890'}]);
        test.mockhttp.lastOptions.should.eql({
            hostname: 'valid-host',
            method: 'GET',
            path: '/supervisor/api/test',
            port: 5000});
    });

    it('should perform a successful POST',function(){
        test.mockhttp.headers['content-length'] = 10;

        new ProxyHelper(client,{hostname: 'valid-host'}).post('/test',{test: 123},test.mockhttp);

        (!!test.mockhttp.events.data).should.be.ok;
        test.mockhttp.events.data(new Buffer('12345'));
        test.mockhttp.events.data(new Buffer('67890'));

        test.mockhttp.written.should.eql(['{"test":123}',null,{send: new Buffer ('1234567890')}]);
        test.mockhttp.lastOptions.should.eql({
            headers: {
                'content-length': 12,
                'content-type': 'application/json;charset=UTF-8'
            },
            hostname: 'valid-host',
            method: 'POST',
            path: '/supervisor/api/test',
            port: 5000});
    });

});