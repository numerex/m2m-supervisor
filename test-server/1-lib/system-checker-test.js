var _ = require('lodash');
var test = require('../test');
var SystemChecker = require(process.cwd() + '/lib/system-checker');

describe('SystemChecker',function(){

    var mockFS = {
        reset: function(){
            mockFS.calls = [];
            mockFS.results = {};
        },
        readFile: function(filename,callback){
            mockFS.calls.push({readFile: filename});
            var results = mockFS.results[filename] || [new Error('file not found'),null];
            callback(results[0],results[1]);
        },
        readdir: function(directory,callback){
            mockFS.calls.push({readdir: directory});
            var results = mockFS.results[directory] || [new Error('directory not found'),null];
            callback(results[0],results[1]);
        }
    };

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('serialport', test.mockserialport);
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockery.registerMock('fs',mockFS);
        test.mockery.warnOnUnregistered(false);
        mockFS.reset();
        test.mockshelljs.reset();
        test.mockserialport.reset();
    });

    afterEach(function() {
        test.mockery.deregisterMock('serialport');
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('fs');
        test.mockery.disable();
        test.mockshelljs.snapshot().should.eql([]);
        test.mockserialport.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect all failures - quiet',function(done){
        test.mockshelljs.lookup['which pm2'] = [1,''];
        test.mockshelljs.lookup['which redis-cli'] = [1,''];
        test.mockshelljs.lookup['which pppd'] = [1,''];
        test.mockshelljs.lookup['which ntpd'] = [1,''];

        var checker = new SystemChecker({verbose: false});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            done();
        });
        checker.checkNow();
    });

    it('should detect all failures - verbose',function(done){
        test.mockshelljs.lookup['which pm2'] = [1,''];
        test.mockshelljs.lookup['which redis-cli'] = [1,''];
        test.mockshelljs.lookup['which pppd'] = [1,''];
        test.mockshelljs.lookup['which ntpd'] = [1,''];

        var checker = new SystemChecker({verbose: true});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            test.pp.snapshot().sort().should.eql([
                '[sys-chk   ] check:pm2 missing',
                '[sys-chk   ] check:redis missing',
                '[sys-chk   ] check:pppd missing',
                '[sys-chk   ] check:ntpd missing',
                '[sys-chk   ] check:debian null',
                '[sys-chk   ] find error: directory not found',
                '[sys-chk   ] check:dataPort null',
                '[sys-chk   ] key:dataPort choice:undefined',
                '[sys-chk   ] check:controlPort null',
                '[sys-chk   ] key:controlPort choice:undefined'
            ].sort());
            done();
        });
        checker.checkNow();
    });

    it('should detect no data or control ports - verbose',function(done){
        test.mockshelljs.lookup['which pm2'] = [0,'/test/pm2'];
        test.mockshelljs.lookup['which redis-cli'] = [0,'/test/redis-cli'];
        test.mockshelljs.lookup['which pppd'] = [0,'/test/pppd'];
        test.mockshelljs.lookup['which ntpd'] = [0,'/test/ntpd'];
        mockFS.results['/etc/dogtag'] = [null,'test dogtag'];
        mockFS.results['/dev/serial/by-id/'] = [null,['ttyTEST1','ttyTEST2','ttyTEST3']];

        var checker = new SystemChecker({timeoutInterval: 10,verbose: true});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            test.pp.snapshot().sort().should.eql([
                '[sys-chk   ] check:pm2 OK',
                '[sys-chk   ] check:redis OK',
                '[sys-chk   ] check:pppd OK',
                '[sys-chk   ] check:ntpd OK',
                '[sys-chk   ] check:debian test dogtag',
                '[sys-chk   ] check:dataPort null',
                '[sys-chk   ] key:dataPort choice:undefined',
                '[sys-chk   ] check:controlPort null',
                '[sys-chk   ] key:controlPort choice:undefined',
                '[sys-chk   ] key:dataPort choice:/dev/serial/by-id/ttyTEST1',
                '[sys-chk   ] key:dataPort choice:/dev/serial/by-id/ttyTEST2',
                '[sys-chk   ] key:dataPort choice:/dev/serial/by-id/ttyTEST3',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST1',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST2',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST3'
            ].sort());
            test.mockserialport.snapshot(); // clear
            done();
        });
        checker.checkNow();
    });

    it('should detect no data or control ports - quiet',function(done){
        test.mockshelljs.lookup['which pm2'] = [0,'/test/pm2'];
        test.mockshelljs.lookup['which redis-cli'] = [0,'/test/redis-cli'];
        test.mockshelljs.lookup['which pppd'] = [0,'/test/pppd'];
        test.mockshelljs.lookup['which ntpd'] = [0,'/test/ntpd'];
        mockFS.results['/etc/dogtag'] = [null,'test dogtag'];
        mockFS.results['/dev/serial/by-id/'] = [null,['ttyTEST1','ttyTEST2','ttyTEST3']];

        var checker = new SystemChecker({timeoutInterval: 10,verbose: false});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            test.mockserialport.snapshot(); // clear
            done();
        });
        checker.checkNow();
    });

    it('should capture data and control ports - verbose',function(done){
        test.mockshelljs.lookup['which pm2'] = [0,'/test/pm2'];
        test.mockshelljs.lookup['which redis-cli'] = [0,'/test/redis-cli'];
        test.mockshelljs.lookup['which pppd'] = [0,'/test/pppd'];
        test.mockshelljs.lookup['which ntpd'] = [0,'/test/ntpd'];
        mockFS.results['/etc/dogtag'] = [null,'test dogtag'];
        mockFS.results['/dev/serial/by-id/'] = [null,['ttyTEST1','ttyTEST2','ttyTEST3']];

        var checker = new SystemChecker({timeoutInterval: 10,verbose: true});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            test.pp.snapshot().should.eql([
                '[sys-chk   ] check:debian test dogtag',
                '[sys-chk   ] key:dataPort choice:/dev/serial/by-id/ttyTEST1',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST1',
                '[sys-chk   ] data:OK',
                '[sys-chk   ] check:dataPort /dev/serial/by-id/ttyTEST1',
                '[sys-chk   ] key:controlPort choice:/dev/serial/by-id/ttyTEST2',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST2',
                '[sys-chk   ] data:',
                '[sys-chk   ] key:controlPort choice:/dev/serial/by-id/ttyTEST3',
                '[sys-chk   ] ready: /dev/serial/by-id/ttyTEST3',
                '[sys-chk   ] data:OK',
                '[sys-chk   ] check:controlPort /dev/serial/by-id/ttyTEST3',
                '[sys-chk   ] check:pm2 OK',
                '[sys-chk   ] check:redis OK',
                '[sys-chk   ] check:pppd OK',
                '[sys-chk   ] check:ntpd OK',
                '[sys-chk   ] command: AT+CGMI',
                '[sys-chk   ] line: ',
                '[sys-chk   ] line: AT+CGMI',
                '[sys-chk   ] data: AT+CGMI - command',
                '[sys-chk   ] line: vendor',
                '[sys-chk   ] data: vendor - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CGMI => vendor',
                '[sys-chk   ] command: AT+CGMM',
                '[sys-chk   ] line: AT+CGMM',
                '[sys-chk   ] data: AT+CGMM - command',
                '[sys-chk   ] line: model',
                '[sys-chk   ] data: model - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CGMM => model',
                '[sys-chk   ] command: AT+CGMR',
                '[sys-chk   ] line: AT+CGMR',
                '[sys-chk   ] data: AT+CGMR - command',
                '[sys-chk   ] line: version',
                '[sys-chk   ] data: version - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CGMR => version',
                '[sys-chk   ] command: AT+CIMI',
                '[sys-chk   ] line: AT+CIMI',
                '[sys-chk   ] data: AT+CIMI - command',
                '[sys-chk   ] line: imsi',
                '[sys-chk   ] data: imsi - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CIMI => imsi',
                '[sys-chk   ] command: AT+CGSN',
                '[sys-chk   ] line: AT+CGSN',
                '[sys-chk   ] data: AT+CGSN - command',
                '[sys-chk   ] line: imei',
                '[sys-chk   ] data: imei - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CGSN => imei',
                '[sys-chk   ] command: AT+CSQ',
                '[sys-chk   ] line: AT+CSQ',
                '[sys-chk   ] data: AT+CSQ - command',
                '[sys-chk   ] line: rssi',
                '[sys-chk   ] data: rssi - match',
                '[sys-chk   ] line: OK',
                '[sys-chk   ] data: OK',
                '[sys-chk   ] result: AT+CSQ => rssi'
            ]);
            test.mockserialport.snapshot(); // clear
            done();
        });
        checker.checkNow();
        test.mockserialport.events.data(new Buffer('OK'));
        test.mockserialport.events.data(new Buffer(''));
        test.mockserialport.events.data(new Buffer('OK'));
        _.defer(function(){
            test.mockserialport.events.data(new Buffer(''));
            test.mockserialport.events.data(new Buffer('AT+CGMI'));
            test.mockserialport.events.data(new Buffer('vendor'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGMM'));
            test.mockserialport.events.data(new Buffer('model'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGMR'));
            test.mockserialport.events.data(new Buffer('version'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CIMI'));
            test.mockserialport.events.data(new Buffer('imsi'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGSN'));
            test.mockserialport.events.data(new Buffer('imei'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CSQ'));
            test.mockserialport.events.data(new Buffer('rssi'));
            test.mockserialport.events.data(new Buffer('OK'));
        });
    });

    it('should capture data and control ports - quiet',function(done){
        test.mockshelljs.lookup['which pm2'] = [0,'/test/pm2'];
        test.mockshelljs.lookup['which redis-cli'] = [0,'/test/redis-cli'];
        test.mockshelljs.lookup['which pppd'] = [0,'/test/pppd'];
        test.mockshelljs.lookup['which ntpd'] = [0,'/test/ntpd'];
        mockFS.results['/etc/dogtag'] = [null,'test dogtag'];
        mockFS.results['/dev/serial/by-id/'] = [null,['ttyTEST1','ttyTEST2','ttyTEST3']];

        var checker = new SystemChecker({timeoutInterval: 10,verbose: false});
        checker.on('ready',function(){
            test.mockshelljs.snapshot().length.should.eql(4);
            test.mockserialport.snapshot(); // clear
            done();
        });
        checker.checkNow();
        test.mockserialport.events.data(new Buffer('OK'));
        test.mockserialport.events.data(new Buffer('OK'));
        _.defer(function(){
            test.mockserialport.events.data(new Buffer('AT+CGMI'));
            test.mockserialport.events.data(new Buffer('vendor'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGMM'));
            test.mockserialport.events.data(new Buffer('model'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGMR'));
            test.mockserialport.events.data(new Buffer('version'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CIMI'));
            test.mockserialport.events.data(new Buffer('imsi'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CGSN'));
            test.mockserialport.events.data(new Buffer('imei'));
            test.mockserialport.events.data(new Buffer('OK'));
            test.mockserialport.events.data(new Buffer('AT+CSQ'));
            test.mockserialport.events.data(new Buffer('rssi'));
            test.mockserialport.events.data(new Buffer('OK'));
        });
    });

});