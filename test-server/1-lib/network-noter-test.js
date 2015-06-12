var _ = require('lodash');
var test = require('../test');
var NetworkNoter = require(process.cwd() + '/lib/network-noter');

describe('NetworkNoter',function(){

    var client = null;

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.registerMock('os',test.mockos);
        test.mockery.warnOnUnregistered(false);
        test.mockos.reset();
        test.mockredis.reset();
        client = test.mockredis.createClient();
    });

    afterEach(function() {
        test.mockery.deregisterMock('then-redis');
        test.mockery.deregisterMock('os');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect a missing interface',function(){
        var noter = new NetworkNoter(client,'xxx');
        noter.noteNow().should.not.be.ok;
    });

    it('should capture address only',function(){
        test.mockos.interfaces.xxx = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',mac: 'aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',mac: 'aa:bb:cc:dd:ee',family: 'IPv4'}];

        var noter = new NetworkNoter(client,'xxx','addressKey');
        noter.noteNow().should.be.ok;
        test.mockredis.snapshot().should.eql([{hmset: ['m2m-config',{addressKey: '1.2.3.4'}]}]);
    });

    it('should capture mac only',function(){
        test.mockos.interfaces.xxx = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',mac: 'aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',mac: 'aa:bb:cc:dd:ee',family: 'IPv4'}];

        var noter = new NetworkNoter(client,'xxx',null,'macKey');
        noter.noteNow().should.be.ok;
        test.mockredis.snapshot().should.eql([{hmset: ['m2m-config',{macKey: 'aa:bb:cc:dd:ee'}]}]);
    });

    it('should capture both address and mac',function(){
        test.mockos.interfaces.xxx = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',mac: 'aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',mac: 'aa:bb:cc:dd:ee',family: 'IPv4'}];

        var noter = new NetworkNoter(client,'xxx','addressKey','macKey');
        noter.noteNow().should.be.ok;
        test.mockredis.snapshot().should.eql([{hmset: ['m2m-config',{addressKey: '1.2.3.4',macKey: 'aa:bb:cc:dd:ee'}]}]);
    });

    it('should note capture mac only if it isn not defined',function(){
        test.mockos.interfaces.xxx = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',family: 'IPv4'}];

        var noter = new NetworkNoter(client,'xxx',null,'macKey');
        noter.noteNow().should.not.be.ok;
    });

    it('should capture address but not mac if it is not defined',function(){
        test.mockos.interfaces.xxx = [{address: 'aa:bb:cc:dd:ee:aa:bb:cc:dd:ee',family: 'IPv6'},{address: '1.2.3.4',family: 'IPv4'}];

        var noter = new NetworkNoter(client,'xxx','addressKey','macKey');
        noter.noteNow().should.be.ok;
        test.mockredis.snapshot().should.eql([{hmset: ['m2m-config',{addressKey: '1.2.3.4'}]}]);
    });

});