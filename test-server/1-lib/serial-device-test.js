var test = require('../test');
var SerialDevice = require(process.cwd() + '/lib/serial-device');

describe('SerialDevice',function() {

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
        var device = new SerialDevice();
        [device.port,device.baudrate,device.retryInterval].should.eql([undefined,NaN,15000]);

        device = new SerialDevice({serialPort: 'a',serialBaudRate: '2',retryInterval: 1});
        [device.port,device.baudrate,device.retryInterval].should.eql(['a',2,1]);
    });

    it('should throw an error opening the device twice',function(){
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234'}).open();
        test.expect(function(){ device.open(); }).to.throw('already open');
        device.close();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
    });

    it('should throw an error closing a device that is already close or not yet open',function(){
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234'});
        test.expect(function(){ device.close(); }).to.throw('not open');

        device.open();
        device.close();
        test.expect(function(){ device.close(); }).to.throw('not open');
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
    });

    it('should note that a device is not ready for writing',function(done){
        var device = new SerialDevice();
        device.writeBuffer(null,function(err){
            err.should.eql('not ready');
            done();
        });
    });

    it('should retry if the device is not ready #1',function(done){
        test.mockserialport.connectException = 'test error';

        var count = 0;
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.on('retry',function(error){
            error.should.eql('Error: test error');
            if (count++ > 0) {
                device.close();
                test.mockserialport.snapshot().should.eql([]);
                done();
            }
        });
        device.open();
    });

    it('should retry if the device is not ready #2',function(done){
        test.mockserialport.openException = 'test error';

        var count = 0;
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.on('retry',function(error){
            error.should.eql('test error');
            if (count++ > 0) {
                device.close();
                test.mockserialport.snapshot().should.eql([
                    {create: ['/dev/tty0',{baudrate: 1234},false]},
                    {open: 'test error'},
                    {create: ['/dev/tty0',{baudrate: 1234},false]},
                    {open: 'test error'},
                    {close: null}
                ]);
                done();
            }
        });
        device.open();
    });

    it('should capture an error event',function(done){
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.on('error',function(error){
            error.should.eql('Error: test error');
            device.close();
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/tty0',{baudrate: 1234},false]},
                {open: null},
                {close: null}
            ]);
            done();
        });
        device.open();
        test.mockserialport.events.error(new Error('test error'));
    });

    it('should capture a data event',function(done){
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.on('data',function(data){
            data.should.eql('test');
            device.close();
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/tty0',{baudrate: 1234},false]},
                {open: null},
                {close: null}
            ]);
            done();
        });
        device.open();
        test.mockserialport.events.data(new Buffer('test'));
    });

    it('should capture an error on writing',function(done){
        test.mockserialport.writeException = 'test error';

        var values = [];
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.open();
        device.writeBuffer('test',function(error){
            values.push(error);
        });
        device.close();
        values.should.eql(['Error: test error']);
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {close: null}
        ]);
        done();
    });

    it('should write a buffer',function(done){
        var values = [];
        var device = new SerialDevice({serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        device.open();
        device.writeBuffer('test',function(error){
            values.push(error);
        });
        device.close();
        values.should.eql([null]);
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/tty0',{baudrate: 1234},false]},
            {open: null},
            {write: 'test'},
            {close: null}
        ]);
        done();
    });

    it('should be created by DeviceBuilder',function(){
        var builder = require(process.cwd() + '/lib/device-builder');
        var device = builder.newDevice({type: 'serial',serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        [device.port,device.baudrate,device.retryInterval].should.eql(['/dev/tty0',1234,1]);
        [builder.newDevice()].should.eql([null]);
    });

    it('should be created by DeviceWatcher',function(){
        var DeviceWatcher = require(process.cwd() + '/lib/device-watcher');
        var watcher = new DeviceWatcher('testKey');
        watcher.start({type: 'serial',serialPort: '/dev/tty0',serialBaudRate: '1234',retryInterval: 1});
        [watcher.device.port,watcher.device.baudrate,watcher.device.retryInterval].should.eql(['/dev/tty0',1234,1]);
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