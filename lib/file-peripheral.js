var _ = require('lodash');
var fs = require('fs');
var util = require('util');

var IoPeripheral = require('./io-peripheral');

function FilePeripheral(config) {
    config = config || {};
    var self = this;
    IoPeripheral.apply(self,[config]);
    self.buffer = new Buffer(64 * 1024);
    self.inFile = config.inFile;
    self.outFile = config.outFile;
    self.on('checkData', _.bind(self.checkData,self));
    self.on('ready',function(){
        self.emit('checkData');
    })
}

util.inherits(FilePeripheral,IoPeripheral);

FilePeripheral.prototype._onOpen = function(callback) {
    this.fdin = fs.openSync(this.inFile,'r');
    callback();
};

FilePeripheral.prototype._onClose = function() {
    // istanbul ignore else - difficult to test after successful open
    if (this.fdin) fs.close(this.fdin);
    this.fdin = null;
};

FilePeripheral.prototype.checkData = function() {
    var self = this;
    if (!self.fdin) return;

    fs.read(self.fdin,self.buffer,0,self.buffer.length,null,function(err,length){
        // istanbul ignore if - difficult to test read failure after successful open
        if (err)
            self.emit('error',err);
        else
            self.emit('data',self.buffer.toString(null,0,length));
        self.emit('checkData');
    });
};

FilePeripheral.prototype._onWrite = function(buffer,callback){
    var fdout = null;
    try {
        fdout = fs.openSync(this.outFile,'w');
        fs.write(fdout,buffer,null,null,function(error){
            fs.close(fdout);
            callback && callback(error);
        });
    } catch (e) {
        // istanbul ignore if - too difficult to test write failure after successful open
        if (fdout) fs.close(fdout);
        throw(e);
    }
};

module.exports = FilePeripheral;

