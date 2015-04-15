var _ = require('lodash');
var fs = require('fs');

function FileDevice(config) {
    var self = this;
    config = _.defaults(config || {},{
        retryInterval:   15*1000
    });
    self.buffer = new Buffer(64 * 1024);
    self.inFile = config.inFile;
    self.outFile = config.outFile;
    self.retryInterval = config.retryInterval;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.dataEventCallback = function(){ self.dataEvent(); };
}

FileDevice.prototype.opened = function(){
    return !!this.openCalled;
};

FileDevice.prototype.ready = function(){
    return !!this.fdin;
};

FileDevice.prototype.open = function(note) {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.noteEvent = note || function(){};
    this.attemptOpen();
    return this;
};

FileDevice.prototype.close = function() {
    if (!this.opened()) throw(new Error('not open'));

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    
    if (this.fdin) fs.close(this.fdin);
    this.fdin = null;

    this.openCalled = false;
};

FileDevice.prototype.attemptOpen = function(){
    try {
        this.timeout = null;
        this.fdin = fs.openSync(this.inFile,'r');
        this.timeout = setTimeout(this.dataEventCallback,1);
        this.noteEvent('ready');
    } catch(e) {
        this.timeout = setTimeout(this.attemptOpenCallback,this.retryInterval);
        this.noteEvent('retry',e);
    }
};

FileDevice.prototype.dataEvent = function() {
    var self = this;
    self.timeout = null;
    self.readBuffer(self.buffer,function(err,length,position){
        if (self.ready())
            self.timeout = setTimeout(self.dataEventCallback,1); // TODO - is there a better way to do this?
        if (err)
            self.noteEvent('error',err);
        else
            self.noteEvent('data',length);
    });
};

FileDevice.prototype.readBuffer = function(buffer,callback) {
    if (this.ready())
        fs.read(this.fdin,buffer,0,buffer.length,null,callback);
    else
        callback('not ready');
};

FileDevice.prototype.writeBuffer = function(buffer,callback){
    if (!this.ready()) return callback('not ready');

    var fdout = null;
    try {
        fdout = fs.openSync(this.outFile,'w');
        fs.write(fdout,buffer,null,null,function(error,written,string){
            fs.close(fdout);
            callback(error);
        });
    } catch (e) {
        // istanbul ignore if - too difficult to test write failure after successful open
        if (fdout) fs.close(fdout);
        callback(e);
    }
};

module.exports = FileDevice;

