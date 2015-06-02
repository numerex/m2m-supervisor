var test = require('../test');
var FilePeripheral = require(process.cwd() + '/lib/file-peripheral');

describe('FilePeripheral',function() {

    it('should properly initialize a new object',function(){
        var peripheral = new FilePeripheral();
        [peripheral.inFile,peripheral.outFile,peripheral.retryInterval].should.eql([undefined,undefined,15000]);

        peripheral = new FilePeripheral({inFile: 'a',outFile: 'b',retryInterval: 1});
        [peripheral.inFile,peripheral.outFile,peripheral.retryInterval].should.eql(['a','b',1]);
    });

    it('should throw an error opening the peripheral twice',function(){
        var peripheral = new FilePeripheral({inFile: '/dev/null'}).open();
        test.expect(function(){ peripheral.open(); }).to.throw('already open');
        peripheral.close();
    });

    it('should throw an error closing a peripheral that is already close or not yet open',function(){
        var peripheral = new FilePeripheral({inFile: '/dev/null'});
        test.expect(function(){ peripheral.close(); }).to.throw('not open');

        peripheral.open();
        peripheral.close();
        test.expect(function(){ peripheral.close(); }).to.throw('not open');
    });

    it('should note that a peripheral is not ready for writing',function(done){
        var peripheral = new FilePeripheral({inFile: '/dev/null'});
        peripheral.writeBuffer(null,function(err){
            err.should.eql(new Error('not ready'));
            done();
        });
    });

    it('should note a write error',function(done){
        var peripheral = new FilePeripheral({inFile: '/dev/null'});
        peripheral
            .on('ready',function() {
                peripheral.writeBuffer('test', function (err) {
                    err.toString().should.eql('TypeError: path must be a string');
                    done();
                });
            })
            .open();
    });

    it('should allow a successful write',function(done){
        var peripheral = new FilePeripheral({inFile: '/dev/null',outFile: '/dev/null'});
        peripheral
            .on('ready',function() {
                peripheral.writeBuffer('test', function (err) {
                    [err].should.eql([null]);
                    done();
                });
            })
            .open();
    });

    it('should be created by PeripheralBuilder',function(){
        var builder = require(process.cwd() + '/lib/peripheral-builder');
        var peripheral = builder.newPeripheral({type: 'file',inFile: 'a',outFile: 'b',retryInterval: 1});
        [peripheral.inFile,peripheral.outFile,peripheral.retryInterval].should.eql(['a','b',1]);
        [builder.newPeripheral()].should.eql([null]);
    });

    it('should be created by PeripheralWatcher',function(){
        var PeripheralWatcher = require(process.cwd() + '/lib/peripheral-watcher');
        var watcher = new PeripheralWatcher('testKey');
        watcher.start({type: 'file',inFile: 'a',outFile: 'b',retryInterval: 1});
        [watcher.peripheral.inFile,watcher.peripheral.outFile,watcher.peripheral.retryInterval].should.eql(['a','b',1]);
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