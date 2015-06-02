var test = require('../test');
var TelnetPeripheral = require(process.cwd() + '/lib/telnet-peripheral');

describe('TelnetPeripheral',function() {

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
        var peripheral = new TelnetPeripheral();
        [peripheral.host,peripheral.port,peripheral.retryInterval].should.eql([undefined,NaN,15000]);

        peripheral = new TelnetPeripheral({telnetAddress: 'a',telnetPort: '2',retryInterval: 1});
        [peripheral.host,peripheral.port,peripheral.retryInterval].should.eql(['a',2,1]);
    });

    it('should throw an error opening the peripheral twice',function(done){
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234'});
        peripheral.on('ready',function(){
            test.expect(function(){ peripheral.open(); }).to.throw('already open');
            peripheral.close();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        peripheral.open();
    });

    it('should throw an error closing a peripheral that is already close or not yet open',function(done){
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234'});
        test.expect(function(){ peripheral.close(); }).to.throw('not open');
        peripheral.on('ready',function(){
            peripheral.close();
            test.expect(function(){ peripheral.close(); }).to.throw('not open');
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        peripheral.open();
    });

    it('should note that a peripheral is not ready for writing',function(done){
        var peripheral = new TelnetPeripheral();
        peripheral.writeBuffer(null,function(err){
            err.should.eql(new Error('not ready'));
            done();
        });
    });

    it('should retry if the peripheral is not ready',function(done){
        test.mocknet.connectException = 'test error';

        var count = 0;
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        peripheral.on('retry',function(error){
            error.should.eql(new Error('test error'));
            if (count++ > 0) {
                peripheral.close();
                test.mocknet.snapshot().should.eql([
                    {end: null}
                ]);
                done();
            }
        });
        peripheral.open();
    });

    it('should capture an error event after open',function(done){
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        peripheral.on('error',function(error){
            error.should.eql(new Error('test error'));
            peripheral.close();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        peripheral.on('ready',function(){
            peripheral.client.events.error(new Error('test error'));
        });
        peripheral.open();
    });

    it('should capture a data event',function(done){
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        peripheral.on('ready',function(){
            peripheral.client.events.data(new Buffer('test'));
        });
        peripheral.on('data',function(data){
            data.should.eql('test');
            peripheral.close();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        peripheral.open();
    });

    it('should capture an error on writing',function(done){
        test.mocknet.writeException = 'test error';

        var values = [];
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        peripheral.on('ready',function(){
            peripheral.writeBuffer('test',function(error){
                values.push(error);
            });
            peripheral.close();
            values.should.eql([new Error('test error')]);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            done();
        });
        peripheral.open();
    });

    it('should write a buffer',function(done){
        var values = [];
        var peripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        peripheral.on('ready',function(){
            peripheral.writeBuffer('test',function(error){
                values.push(error);
            });
            peripheral.close();
            values.should.eql([null]);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {write: 'test'},
                {end: null}
            ]);
            done();
        });
        peripheral.open();
    });

    it('should be created by PeripheralBuilder',function(){
        var builder = require(process.cwd() + '/lib/peripheral-builder');
        var peripheral = builder.newPeripheral({type: 'telnet',telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        [peripheral.host,peripheral.port,peripheral.retryInterval].should.eql(['host',1234,1]);
        [builder.newPeripheral()].should.eql([null]);
    });

    it('should be created by PeripheralWatcher',function(){
        var PeripheralWatcher = require(process.cwd() + '/lib/peripheral-watcher');
        var watcher = new PeripheralWatcher('testKey');
        watcher.start({type: 'telnet',telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
        [watcher.peripheral.host,watcher.peripheral.port,watcher.peripheral.retryInterval].should.eql(['host',1234,1]);
        watcher.stop();
        [watcher.peripheral].should.eql([null]);
        test.pp.snapshot().should.eql([
            '[peripheral] start watching: testKey',
            '[peripheral] check ready: testKey',
            '[peripheral] now ready: testKey',
            '[peripheral] stop watching: testKey'
        ]);
    })

});