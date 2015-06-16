var _ = require('lodash');
var fs = require('fs');
var ftp = require('ftp');
var util = require('util');
var events = require('events');

var logger = require('./logger')('ftp-setup');

function FtpSetup(deviceName){
    var self = this;

    self.targetPath = process.env.M2M_SETUP_PATH || '/etc/m2m-supervisor/';
    self.ftp = new ftp(); // NOTE delayed for testing
    self.ftp.on('error',function(error){
        logger.error('ftp error: ' + error.message);
        self.emit('done',error);
    });
    self.ftp.on('ready', _.bind(self.emit,self,'getDefaults'));

    self.on('getDefaults', _.bind(self.refreshFiles,self,'default/','getOverrides'));
    self.on('getOverrides', _.bind(self.refreshFiles,self,'imei-' + deviceName + '/','success'));
    self.on('nextFile', _.bind(self.nextFile,self));
    self.on('error',function(error){
        logger.error('error: ' + error.message);
        self.emit('done',error);
    });
    self.on('success',function(){
        logger.info('download successful');
        self.emit('done',null);
    });
    self.on('done',function(result){
        self.ftp.end();
        self.finishCallback && self.finishCallback(result);
    });
}

util.inherits(FtpSetup,events.EventEmitter);

FtpSetup.prototype.setupNow = function(finishCallback){
    this.finishCallback = finishCallback || function(){};

    var setup = require('../lib/global-setup');
    if (setup.error) {
        logger.error('setup error: ' + setup.error.message);
        return this.finishCallback(setup.error);
    }

    var missing = _.difference(['host','user','password'], _.keys(setup.setup.ftp));
    if (missing.length > 0) {
        var error = new Error('FTP config missing: ' + missing);
        logger.error(error.message);
        return this.finishCallback(error);
    }

    this.ftp.connect(setup.setup.ftp);
};

FtpSetup.prototype.refreshFiles = function(directory,nextEvent){
    var self = this;
    logger.info('directory: ' + directory);
    self.ftp.list(directory,function (error, list) {
        if (error) return self.emit('error',error);

        if (!fs.existsSync(self.targetPath)) fs.mkdirSync(self.targetPath);

        self.nextEvent = nextEvent;
        self.elements = [];
        list.forEach(function (element, index, array) {
            if (element.type === 'd') return;

            element.sourceFile = directory + element.name;
            element.targetFile = self.targetPath + element.name;
            if (self.fileNeeded(element)) self.elements.push(element);
        });

        self.emit('nextFile');
    });
};

FtpSetup.prototype.nextFile = function(){
    var self = this;
    var element = self.elements.shift();
    if (!element) return self.emit(self.nextEvent,null);

    logger.info('download: ' + element.sourceFile + ' => ' + element.targetFile);
    self.ftp.get(element.sourceFile,function (error,readStream) {
        if (error) return self.emit('error',error);

        var writeStream = fs.createWriteStream(element.targetFile);
        writeStream.on('error',function(error){
            logger.error('write error: ' + error.message);
            self.emit('done',error);
        });

        readStream.on('error',function(error){
            logger.error('read error: ' + error.message);
            self.emit('done',error);
        });
        readStream.once('close', function () {
            self.emit('nextFile');
        });

        readStream.pipe(writeStream);
    });
};

FtpSetup.prototype.fileNeeded = function(element){
    if (!fs.existsSync(element.targetFile)) return true;

    var stat = fs.statSync(element.targetFile);
    return stat.size !== element.size || stat.mdate < element.date;
};

module.exports = FtpSetup;