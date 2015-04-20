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

});