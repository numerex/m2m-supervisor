var test = require('../test');
var TelnetDevice = require(process.cwd() + '/lib/telnet-device');

describe('TelnetDevice',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.warnOnUnregistered(false);
        test.mocknet.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('net');
        test.mockery.disable();
        test.mocknet.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize a new object',function(){
        var device = new TelnetDevice();
        [device.host,device.port,device.retryInterval].should.eql([undefined,NaN,15000]);

        device = new TelnetDevice({telnetAddress: 'a',telnetPort: '2',retryInterval: 1});
        [device.host,device.port,device.retryInterval].should.eql(['a',2,1]);
    });

    it('should throw an error opening the device twice',function(){
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234'}).open();
        test.expect(function(){ device.open(); }).to.throw('already open');
        device.close();
        test.mocknet.snapshot().should.eql([
            {connect: {host: 'host',port: 1234}},
            {end: null}
        ]);
    });

    it('should throw an error closing a device that is already close or not yet open',function(){
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234'});
        test.expect(function(){ device.close(); }).to.throw('not open');

        device.open();
        device.close();
        test.expect(function(){ device.close(); }).to.throw('not open');
        test.mocknet.snapshot().should.eql([
            {connect: {host: 'host',port: 1234}},
            {end: null}
        ]);
    });

    it('should note that a device is not ready for writing',function(done){
        var device = new TelnetDevice();
        device.writeBuffer(null,function(err){
            err.should.eql('not ready');
            done();
        });
    });

    it('should retry if the device is not ready',function(done){
        test.mocknet.connectException = 'test error';

        var count = 0;
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        device.on('retry',function(error){
            error.should.eql(new Error('test error'));
            if (count++ > 0) {
                device.close();
                done();
            }
        });
        device.open();
    });

    it('should capture an error event',function(done){
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        device.on('retry',function(error){
            error.should.eql(new Error('test error'));
            device.close();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        device.open();
        device.client.events.error(new Error('test error'));
    });

    it('should capture a data event',function(done){
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        device.on('data',function(data){
            data.should.eql('test');
            device.close();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        device.open();
        device.client.events.data(new Buffer('test'));
    });

    it('should capture an error on writing',function(done){
        test.mocknet.writeException = 'test error';

        var values = [];
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        device.open();
        device.writeBuffer('test',function(error){
            values.push(error);
        });
        device.close();
        values.should.eql(['Error: test error']);
        test.mocknet.snapshot().should.eql([
            {connect: {host: 'host',port: 1234}},
            {end: null}
        ]);
        done();
    });

    it('should write a buffer',function(done){
        var values = [];
        var device = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        device.open();
        device.writeBuffer('test',function(error){
            values.push(error);
        });
        device.close();
        values.should.eql([null]);
        test.mocknet.snapshot().should.eql([
            {connect: {host: 'host',port: 1234}},
            {write: 'test'},
            {end: null}
        ]);
        done();
    });

    it('should be created by DeviceBuilder',function(){
        var builder = require(process.cwd() + '/lib/device-builder');
        var device = builder.newDevice({type: 'telnet',telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        [device.host,device.port,device.retryInterval].should.eql(['host',1234,1]);
        [builder.newDevice()].should.eql([null]);
    });

    it('should be created by DeviceWatcher',function(){
        var DeviceWatcher = require(process.cwd() + '/lib/device-watcher');
        var watcher = new DeviceWatcher('testKey');
        watcher.start({type: 'telnet',telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        [watcher.device.host,watcher.device.port,watcher.device.retryInterval].should.eql(['host',1234,1]);
        watcher.stop();
        [watcher.device].should.eql([null]);
        test.pp.snapshot().should.eql([
            '[device    ] start watching: testKey',
            '[device    ] check ready: testKey',
            '[device    ] now ready: testKey',
            '[device    ] stop watching: testKey'
        ]);
    })

});