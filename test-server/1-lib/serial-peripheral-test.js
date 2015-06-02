var test = require('../test');
var SerialPeripheral = require(process.cwd() + '/lib/serial-peripheral');

describe('SerialPeripheral',function() {

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('serialport', test.mockserialport);
        test.mockery.warnOnUnregistered(false);
        test.mockserialport.reset();
    });

    afterEach(function () {
        test.mockery.deregisterMock('serialport');
        test.mockery.disable();
        test.mockserialport.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize a new object',function(){
        var peripheral = new SerialPeripheral();
        [peripheral.port,peripheral.baudrate,peripheral.retryInterval].should.eql([undefined,NaN,15000]);

        peripheral = new SerialPeripheral({serialPort: 'a',serialBaudRate: '2',retryInterval: 1});
        [peripheral.port,peripheral.baudrate,peripheral.retryInterval].should.eql(['a',2,1]);
    });

    it('should throw an error opening the peripheral twice',function(){
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234'}).open();
        test.expect(function(){ peripheral.open(); }).to.throw('already open');
        peripheral.close();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
    });

    it('should throw an error closing a peripheral that is already close or not yet open',function(){
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234'});
        test.expect(function(){ peripheral.close(); }).to.throw('not open');

        peripheral.open();
        peripheral.close();
        test.expect(function(){ peripheral.close(); }).to.throw('not open');
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
    });

    it('should note that a peripheral is not ready for writing',function(done){
        var peripheral = new SerialPeripheral();
        peripheral.writeBuffer(null,function(err){
            err.should.eql(new Error('not ready'));
            done();
        });
    });

    it('should retry if the peripheral is not ready #1',function(done){
        test.mockserialport.connectException = 'test error';

        var count = 0;
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.on('retry',function(error){
            error.should.eql(new Error('test error'));
            if (count++ > 0) {
                peripheral.close();
                test.mockserialport.snapshot().should.eql([]);
                done();
            }
        });
        peripheral.open();
    });

    it('should retry if the peripheral is not ready #2',function(done){
        test.mockserialport.openException = 'test error';

        var count = 0;
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.on('retry',function(error){
            error.should.eql('test error');
            if (count++ > 0) {
                peripheral.close();
                test.mockserialport.snapshot().should.eql([
                    {create: ['/dev/tty0',{baudrate: 1234},false]},
                    {open: 'test error'},
                    {create: ['/dev/tty0',{baudrate: 1234},false]},
                    {open: 'test error'}
                ]);
                done();
            }
        });
        peripheral.open();
    });

    it('should capture an error event',function(done){
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.on('error',function(error){
            error.should.eql('Error: test error');
            peripheral.close();
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/tty0',{baudrate: 1234},false]},
                {open: null},
                {close: null}
            ]);
            done();
        });
        peripheral.open();
        test.mockserialport.events.error(new Error('test error'));
    });

    it('should capture a data event',function(done){
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.on('data',function(data){
            data.should.eql('test');
            peripheral.close();
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/tty0',{baudrate: 1234},false]},
                {open: null},
                {close: null}
            ]);
            done();
        });
        peripheral.open();
        test.mockserialport.events.data(new Buffer('test'));
    });

    it('should capture an error on writing',function(done){
        test.mockserialport.writeException = 'test error';

        var values = [];
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.open();
        peripheral.writeBuffer('test',function(error){
            values.push(error);
        });
        peripheral.close();
        values.should.eql([new Error('test error')]);
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
        done();
    });

    it('should write a buffer',function(done){
        var values = [];
        var peripheral = new SerialPeripheral({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        peripheral.open();
        peripheral.writeBuffer('test',function(error){
            values.push(error);
        });
        peripheral.close();
        values.should.eql([null]);
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {write: 'test'},
            {close: null}
        ]);
        done();
    });

    it('should be created by PeripheralBuilder',function(){
        var builder = require(process.cwd() + '/lib/peripheral-builder');
        var peripheral = builder.newPeripheral({type: 'serial',serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        [peripheral.port,peripheral.baudrate,peripheral.retryInterval].should.eql(['/dev/tty0',1234,1]);
        [builder.newPeripheral()].should.eql([null]);
    });

    it('should be created by PeripheralWatcher',function(){
        var PeripheralWatcher = require(process.cwd() + '/lib/peripheral-watcher');
        var watcher = new PeripheralWatcher('testKey');
        watcher.start({type: 'serial',serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        [watcher.peripheral.port,watcher.peripheral.baudrate,watcher.peripheral.retryInterval].should.eql(['/dev/tty0',1234,1]);
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