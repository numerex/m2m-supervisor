var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var events = require('events');

var globalCounter = 0;

function FileDevice(config) {
    var self = this;
    self.instance = ++globalCounter;
    config = _.defaults(config || {},{
        retryInterval:   15*1000
    });
    self.buffer = new Buffer(64 * 1024);
    self.inFile = config.inFile;
    self.outFile = config.outFile;
    self.retryInterval = config.retryInterval;
    self.attemptOpenCallback = function(){ self.attemptOpen(); };
    self.checkDataCallback = function(){ self.checkData(); };
    self.on('attemptOpen',self.attemptOpenCallback);
    self.on('checkData',self.checkDataCallback);
    self.on('ready',function(){
        self.emit('checkData');
    })
}

util.inherits(FileDevice,events.EventEmitter);

FileDevice.prototype.opened = function(){
    return !!this.openCalled;
};

FileDevice.prototype.ready = function(){
    return !!this.fdin;
};

FileDevice.prototype.open = function() {
    if (this.opened()) throw(new Error('already open'));

    this.openCalled = true;
    this.emit('attemptOpen');
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
    var self = this;
    try {
        self.timeout = null;
        self.fdin = fs.openSync(self.inFile,'r');
        _.defer(function(){ self.emit('ready'); });
    } catch(e) {
        self.timeout = setTimeout(function(){ self.emit('attemptOpen'); },self.retryInterval);
        self.emit('retry', e.toString());
    }
};

FileDevice.prototype.checkData = function() {
    var self = this;
    if (self.ready())
        fs.read(self.fdin,self.buffer,0,self.buffer.length,null,function(err,length){
            if (self.ready()){
                if (err)
                    self.emit('error',err);
                else
                    self.emit('data',self.buffer.toString(null,0,length));
                self.emit('checkData');
            }
        });
};

FileDevice.prototype.writeBuffer = function(buffer,callback){
    if (!this.ready()) return callback && callback('not ready');

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
        callback && callback(e.toString());
    }
};

module.exports = FileDevice;

