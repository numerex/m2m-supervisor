var test = require('../test');
var ModemWatcher = require(process.cwd() + '/services/modem-watcher');

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

    var foundEvents = null;
    var expectEvents = null;
    var noteEvents = function(event) { foundEvents.push(event); };

    beforeEach(function() {
        foundEvents = [];
        expectEvents = [];
    });

    afterEach(function() {
// TODO consider how to test for events...
//console.log('found: ' + foundEvents);
//console.log('expect:' + expectEvents);
//console.log('...');
//console.log('');
        //foundEvents.should.eql(expectEvents);
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
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 100});
        watcher.on('note',noteEvents);
        expectEvents = ['ready'];
        watcher.on('note',function(event){
            event.should.eql('ready');
            watcher.started().should.be.ok;
            watcher.ready().should.be.ok;
            watcher.stop();
            watcher.started().should.not.be.ok;
            watcher.ready().should.not.be.ok;
            test.pp.snapshot().should.eql([
                '[modem     ] start watcher',
                '[modem     ] stop watcher']);
            done();
        });
        watcher.start();
    });

    it('should capture an IMEI',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-imei.txt',commandFile: '/dev/null'});
        watcher.on('note',noteEvents);
        expectEvents = ['ready','requestIMEI','requestRSSI'];
        watcher.on('imei',function(imei){
            [imei].should.eql(['352214046337094']);
            watcher.imei.should.eql('352214046337094');
            watcher.imeiCandidates.should.eql(['352214046337094','OK','352214046337094','OK']);
            watcher.stop();
            test.pp.snapshot().should.eql([
                '[modem     ] start watcher',
                '[modem     ] RSSI: 21,99',
                '[modem     ] IMEI: 352214046337094',
                '[modem     ] stop watcher'
            ]);
            done();
        });
        watcher.start();
    });

    it('should process test file',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 100});
        watcher.on('note',noteEvents);
        expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
        watcher.on('note',function(event){
            if (event == 'requestRSSI' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
                    '[modem     ] RSSI: 24,99',
                    '[modem     ] stop watcher']);
                done();
            }
        });
        watcher.start();
    });

    it('should trigger interval',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: '/dev/null',commandFile: '/dev/null',rssiInterval: 100});
        watcher.on('note',noteEvents);
        expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
        watcher.on('note',function(event){
            if (event == 'requestRSSI' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    '[modem     ] stop watcher']);
                done();
            }
        });
        watcher.start();
    });

    it('should process test file and trigger interval',function(done){
        var events = {};
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null',rssiInterval: 100})
            .on('note',noteEvents)
            .on('note',function(event){
            events[event] = (events[event] || 0) + 1;
            if (events.requestRSSI && events.requestRSSI > 1) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
                    '[modem     ] RSSI: 24,99',
                    '[modem     ] stop watcher']);
                events = {};
                done();
            }
        }).start();
        expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
    });

    it('should catch a flow and rssi errors',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-errors.txt',commandFile: '/dev/null'});
        watcher.on('note',noteEvents);
        expectEvents = ['ready','requestIMEI','requestRSSI','error','error'];
        watcher.on('note',function(event){
            if (event == 'error' && count++ > 0 && watcher.started()) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    //'[modem     ] FLOW: ',
                    '[modem     ] flow error: Error: invalid value',
                    '[modem     ] RSSI:',
                    '[modem     ] rssi error: Error: invalid value',
                    '[modem     ] stop watcher']);
                done();
            }
        });
        watcher.start();
    });

    it('should catch an error opening the report file',function(done){
        var count = 0;
        var watcher = new ModemWatcher({reportFile: 'unknown.file',commandFile: null,rssiInterval: 100,retryInterval: 1});
        watcher.on('note',noteEvents);
        expectEvents = ['retry','retry'];
        watcher.on('note',function(event){
            if (event == 'retry' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
                    "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
                    '[modem     ] stop watcher']);
                done();
            }
        });
        watcher.start();
    });

    it('should catch an error opening the command file',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-empty.txt',commandFile: null});
        watcher.on('note',noteEvents);
        expectEvents = ['ready','error'];
        watcher.on('note',function(event){
            if (event == 'error') {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watcher',
                    '[modem     ] request error: TypeError: path must be a string',
                    '[modem     ] stop watcher']);
                done();
            }
        });
        watcher.start();
    });

    it('should throw an error if start called twice',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null'})
            .on('note',noteEvents)
            .start();
        expectEvents = ['ready'];
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[modem     ] start watcher',
            '[modem     ] stop watcher']);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new ModemWatcher({reportFile: 'test-server/data/modem-test.txt',commandFile: '/dev/null'});
        watcher.on('note',noteEvents);
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should detect a device read error',function(done){
        var watcher = new ModemWatcher({reportFile: '/dev/null',commandFile: '/dev/null'});
        watcher.device.emit('error','test error');
        test.pp.snapshot().should.eql(['[modem     ] read error: test error']);
        done();
    });

});