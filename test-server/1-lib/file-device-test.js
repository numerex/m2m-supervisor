var test = require('../test');
var FileDevice = require(process.cwd() + '/lib/file-device');

describe('FileDevice',function() {

    it('should properly initialize a new object',function(){
        var device = new FileDevice();
        [device.inFile,device.outFile,device.retryInterval].should.eql([undefined,undefined,15000]);

        device = new FileDevice({inFile: 'a',outFile: 'b',retryInterval: 1});
        [device.inFile,device.outFile,device.retryInterval].should.eql(['a','b',1]);
    });

    it('should throw an error opening the device twice',function(){
        var device = new FileDevice({inFile: '/dev/null'}).open();
        test.expect(function(){ device.open(); }).to.throw('already open');
        device.close();
    });

    it('should throw an error closing a device that is already close or not yet open',function(){
        var device = new FileDevice({inFile: '/dev/null'});
        test.expect(function(){ device.close(); }).to.throw('not open');

        device.open();
        device.close();
        test.expect(function(){ device.close(); }).to.throw('not open');
    });

    it('should note that a device is not ready for writing',function(done){
        var device = new FileDevice({inFile: '/dev/null'});
        device.writeBuffer(null,function(err){
            err.should.eql('not ready');
            done();
        });
    });

    it('should note a write error',function(done){
        var device = new FileDevice({inFile: '/dev/null'});
        device
            .on('ready',function() {
                device.writeBuffer('test', function (err) {
                    [err].should.eql(['TypeError: path must be a string']);
                    done();
                });
            })
            .open();
    });

    it('should allow a successful write',function(done){
        var device = new FileDevice({inFile: '/dev/null',outFile: '/dev/null'});
        device
            .on('ready',function() {
                device.writeBuffer('test', function (err) {
                    [err].should.eql([null]);
                    done();
                });
            })
            .open();
    });

    it('should be created by DeviceBuilder',function(){
        var builder = require(process.cwd() + '/lib/device-builder');
        var device = builder.newDevice({type: 'file',inFile: 'a',outFile: 'b',retryInterval: 1});
        [device.inFile,device.outFile,device.retryInterval].should.eql(['a','b',1]);
        [builder.newDevice()].should.eql([null]);
    });

    it('should be created by DeviceWatcher',function(){
        var DeviceWatcher = require(process.cwd() + '/lib/device-watcher');
        var watcher = new DeviceWatcher('testKey');
        watcher.start({type: 'file',inFile: 'a',outFile: 'b',retryInterval: 1});
        [watcher.device.inFile,watcher.device.outFile,watcher.device.retryInterval].should.eql(['a','b',1]);
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