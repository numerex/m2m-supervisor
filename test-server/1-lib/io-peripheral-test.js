var util = require('util');

var test = require('../test');
var IoPeripheral = require(process.cwd() + '/lib/io-peripheral');

describe('IoPeripheral',function() {

    it('should properly initialize a new object',function(){
        var peripheral = new IoPeripheral();
        [peripheral.retryInterval].should.eql([15000]);

        peripheral = new IoPeripheral({retryInterval: 1});
        [peripheral.retryInterval].should.eql([1]);
    });

    function TestPeripheral(config){
        IoPeripheral.apply(this,[{retryInterval: 10}]);
    }

    util.inherits(TestPeripheral,IoPeripheral);

    TestPeripheral.prototype._onOpen = function(callback){
        callback();
    };

    TestPeripheral.prototype._onClose = function(){

    };

    TestPeripheral.prototype._onWrite = function(buffer,callback){

    };

    it('should throw an error closing a peripheral that is already close or not yet open',function(){
        var peripheral = new TestPeripheral();
        test.expect(function(){ peripheral.close(); }).to.throw('not open');

        peripheral.open();
        peripheral.close();
        test.expect(function(){ peripheral.close(); }).to.throw('not open');
    });

    it('should note that a peripheral is not ready for writing',function(done){
        var peripheral = new IoPeripheral();
        peripheral.writeBuffer(null,function(err){
            err.should.eql(new Error('not ready'));
            done();
        });
    });

});