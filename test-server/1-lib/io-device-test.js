var util = require('util');

var test = require('../test');
var IoDevice = require(process.cwd() + '/lib/io-device');

describe('IoDevice',function() {

    it('should properly initialize a new object',function(){
        var device = new IoDevice();
        [device.retryInterval].should.eql([15000]);

        device = new IoDevice({retryInterval: 1});
        [device.retryInterval].should.eql([1]);
    });

    function TestDevice(config){
        IoDevice.apply(this,[{retryInterval: 10}]);
    }

    util.inherits(TestDevice,IoDevice);

    TestDevice.prototype._onOpen = function(callback){
        callback();
    };

    TestDevice.prototype._onClose = function(){

    };

    TestDevice.prototype._onWrite = function(buffer,callback){

    };

    it('should throw an error closing a device that is already close or not yet open',function(){
        var device = new TestDevice();
        test.expect(function(){ device.close(); }).to.throw('not open');

        device.open();
        device.close();
        test.expect(function(){ device.close(); }).to.throw('not open');
    });

    it('should note that a device is not ready for writing',function(done){
        var device = new IoDevice();
        device.writeBuffer(null,function(err){
            err.should.eql(new Error('not ready'));
            done();
        });
    });

});