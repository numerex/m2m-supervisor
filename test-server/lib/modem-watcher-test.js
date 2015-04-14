var test = require('../test');
var ModemWatcher = require(process.cwd() + '/lib/modem-watcher');

var huaweiSerialPorts = [ // NOTE - may come in handy later...
    {
        comName:        '/dev/ttyUSB0',
        manufacturer:   'HUAWEI_Technology',
        serialNumber:   'HUAWEI_Technology_HUAWEI_Mobile',
        pnpId:          'gsmmodem',
        vendorId:       '0x12d1',
        productId:      '0x1001' },
    {   comName:        '/dev/ttyUSB1',
        manufacturer:   'HUAWEI_Technology',
        serialNumber:   'HUAWEI_Technology_HUAWEI_Mobile',
        pnpId:          'usb-HUAWEI_Technology_HUAWEI_Mobile-if01-port0',
        vendorId:       '0x12d1',
        productId:      '0x1001' },
    {   comName:        '/dev/ttyUSB2',
        manufacturer:   'HUAWEI_Technology',
        serialNumber:   'HUAWEI_Technology_HUAWEI_Mobile',
        pnpId:          'usb-HUAWEI_Technology_HUAWEI_Mobile-if02-port0',
        vendorId:       '0x12d1',
        productId:      '0x1001' } ];

describe('ModemWatcher',function(){

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('lynx',test.mocklynx);
        test.mockery.warnOnUnregistered(false);
        //test.mockery.registerAllowables([process.cwd() + '/node_modules/mocha/lib/utils','./statsd-client']);
    });

    afterEach(function() {
        test.mockery.deregisterMock('lynx');
        test.mockery.disable();
        test.mocklynx.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize with no parameters',function(){
        var watcher = new ModemWatcher();
        watcher.config.should.eql({
            reportFile: '/dev/ttyUSB2',
            commandFile: '/dev/ttyUSB2',
            rssiInterval: 60000});
    });

    it('should be immediately stopped',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 10});
        watcher.start(function(event){
            event.should.eql('ready');
            watcher.started().should.be.ok;
            watcher.ready().should.be.ok;
            watcher.stop();
            watcher.started().should.not.be.ok;
            watcher.ready().should.not.be.ok;
            test.pp.snapshot().should.eql([
                '[modem     ] start watcher',
                '[modem     ] stop watcher']);
            test.mocklynx.snapshot().should.eql([
                {increment: 'started'},
                {increment: 'stopped'}]);
            done();
        });
    });

    it('should capture an IMEI',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-imei.txt',commandFile: '/dev/null'});
        watcher.start(function(event){
            if (event == 'report') {
                watcher.imeiCandidates.should.eql(['352214046337094','OK','352214046337094','OK']);
                watcher.imei.should.eql('352214046337094');
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    '[modem     ] RSSI: 21,99',
                    '[modem     ] IMEI: 352214046337094',
                    '[modem     ] stop watcher'                    
                ]);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    {increment: 'rssi-request'},
                    {gauge: 'rssi',value: 21},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should process test file',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 10});
        watcher.start(function(event){
            if (event == 'rssi' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
                    '[modem     ] RSSI: 24,99',
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    {increment: 'rssi-request'},
                    {send: {rxflow: "86539|g",rxqos: "1080000|g",rxrate: "0|g",txflow: "65854|g",txqos: "712000|g",txrate: "0|g"}},
                    {gauge: "rssi",value: 24},
                    {increment: 'rssi-request'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should trigger interval',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: '/dev/null',commandFile: '/dev/null',rssiInterval: 10});
        watcher.start(function(event){
            if (event == 'rssi' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    {increment: 'rssi-request'},
                    {increment: 'rssi-request'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should process test file and trigger interval',function(done){
        var events = {};
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 10}).start(function(event){
            events[event] = (events[event] || 0) + 1;
            if (events.report && events.rssi && events.rssi > 1) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
                    '[modem     ] RSSI: 24,99',
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    {increment: 'rssi-request'},
                    {send: {rxflow: "86539|g",rxqos: "1080000|g",rxrate: "0|g",txflow: "65854|g",txqos: "712000|g",txrate: "0|g"}},
                    {gauge: "rssi",value: 24},
                    {increment: 'rssi-request'},
                    {increment: 'stopped'}
                ]);
                events = {};
                done();
            }
        });
    });

    it('should catch a flow and rssi errors',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-errors.txt',commandFile: '/dev/null'});
        watcher.start(function(event){
            if (event == 'report' && count++ > 1) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: ',
                    '[modem     ] flow error: Error: invalid value',
                    '[modem     ] RSSI:',
                    '[modem     ] rssi error: Error: invalid value',
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    {increment: 'rssi-request'},
                    {increment: 'error'},
                    {increment: 'error'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should catch an error opening the report file',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'unknown.file',commandFile: null,rssiInterval: 10});
        watcher.start(function(event){
            if (event == 'retry' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
                    "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'retry'},
                    {increment: 'retry'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should catch an error opening the command file',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-empty.txt',commandFile: null});
        watcher.start(function(event){
            if (event == 'error') {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    '[modem     ] request error: TypeError: path must be a string',
                    '[modem     ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'imei-request'},
                    //{increment: 'rssi-request'},
                    {increment: 'error'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should throw an error if start called twice',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null'}).start();
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[modem     ] start watcher',
            '[modem     ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'stopped'}]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null'});
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mocklynx.snapshot().should.eql([]);
        done();
    });

});