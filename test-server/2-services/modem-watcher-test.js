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

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('serialport', test.mockserialport);
        test.mockery.warnOnUnregistered(false);
        test.mockserialport.reset();
        foundEvents = [];
        expectEvents = [];
    });

    afterEach(function () {
        test.mockery.deregisterMock('serialport');
        test.mockery.disable();
        test.mockserialport.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should be immediately stopped',function(done){
        var watcher = new ModemWatcher();
        watcher.on('note',noteEvents);
        expectEvents = ['ready'];
        watcher.on('note',function(event){
            event.should.eql('ready');
            watcher.started().should.be.ok;
            watcher.ready().should.be.ok;
            watcher.stop();
            watcher.started().should.not.be.ok;
            watcher.ready().should.not.be.ok;
            test.mockserialport.snapshot().should.eql([
                {create: ['test-server/data/modem-test.txt',{baudrate: NaN},false]},
                {open: null},
                {close: null}
            ]);
            test.pp.snapshot().should.eql([
                '[modem     ] start watching',
                '[modem     ] stop watching']);
            done();
        });
        watcher.start({serialPort: 'test-server/data/modem-test.txt',rssiInterval: 100});
    });

    //it('should process test file',function(done){
    //    var count = 0;
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
    //    watcher.on('note',function(event){
    //        if (event == 'requestRSSI' && count++ > 0) {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
    //                '[modem     ] RSSI: 24,99',
    //                '[modem     ] stop watching']);
    //            done();
    //        }
    //    });
    //    watcher.start({serialPort: 'test-server/data/modem-test.txt',rssiInterval: 100});
    //});
    //
    //it('should trigger interval',function(done){
    //    var count = 0;
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
    //    watcher.on('note',function(event){
    //        if (event == 'requestRSSI' && count++ > 0) {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                '[modem     ] stop watching']);
    //            done();
    //        }
    //    });
    //    watcher.start({serialPort: '/dev/null',rssiInterval: 100});
    //});
    //
    //it('should process test file and trigger interval',function(done){
    //    var events = {};
    //    var watcher = new ModemWatcher()
    //        .on('note',noteEvents)
    //        .on('note',function(event){
    //        events[event] = (events[event] || 0) + 1;
    //        if (events.requestRSSI && events.requestRSSI > 1) {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                //'[modem     ] FLOW: 000035D4,00000000,00000000,000000000001013E,000000000001520B,000ADD40,00107AC0',
    //                '[modem     ] RSSI: 24,99',
    //                '[modem     ] stop watching']);
    //            events = {};
    //            done();
    //        }
    //    }).start({serialPort: 'test-server/data/modem-test.txt',rssiInterval: 100});
    //    expectEvents = ['ready','requestIMEI','requestRSSI','requestRSSI'];
    //});
    //
    //it('should catch a flow and rssi errors',function(done){
    //    var count = 0;
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    expectEvents = ['ready','requestIMEI','requestRSSI','error','error'];
    //    watcher.on('note',function(event){
    //        if (event == 'error' && count++ > 0 && watcher.started()) {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                //'[modem     ] FLOW: ',
    //                '[modem     ] flow error: Error: invalid value',
    //                '[modem     ] RSSI:',
    //                '[modem     ] rssi error: Error: invalid value',
    //                '[modem     ] stop watching']);
    //            done();
    //        }
    //    });
    //    watcher.start({serialPort: 'test-server/data/modem-errors.txt'});
    //});
    //
    //it('should catch an error opening the report file',function(done){
    //    var count = 0;
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    expectEvents = ['retry','retry'];
    //    watcher.on('note',function(event){
    //        if (event == 'retry' && count++ > 0) {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
    //                "[modem     ] start error: Error: ENOENT, no such file or directory 'unknown.file'",
    //                '[modem     ] stop watching']);
    //            done();
    //        }
    //    });
    //    watcher.start({reportFile: 'unknown.file',commandFile: null,rssiInterval: 100,retryInterval: 1});
    //});
    //
    //it('should catch an error opening the command file',function(done){
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    expectEvents = ['ready','error'];
    //    watcher.on('note',function(event){
    //        if (event == 'error') {
    //            watcher.stop();
    //            test.pp.snapshot().should.eql([
    //                '[modem     ] start watching',
    //                '[modem     ] request error: TypeError: path must be a string',
    //                '[modem     ] stop watching']);
    //            done();
    //        }
    //    });
    //    watcher.start({reportFile: 'test-server/data/modem-empty.txt',commandFile: null});
    //});
    //
    //it('should throw an error if start called twice',function(done){
    //    var watcher = new ModemWatcher()
    //        .on('note',noteEvents)
    //        .start({serialPort: 'test-server/data/modem-test.txt'});
    //    expectEvents = ['ready'];
    //    test.expect(function(){ watcher.start(); }).to.throw('already started');
    //    watcher.stop();
    //    test.pp.snapshot().should.eql([
    //        '[modem     ] start watching',
    //        '[modem     ] stop watching']);
    //    done();
    //});
    //
    //it('should throw an error if stopped before started',function(done){
    //    var watcher = new ModemWatcher();
    //    watcher.on('note',noteEvents);
    //    test.expect(function(){ watcher.stop(); }).to.throw('not started');
    //    test.pp.snapshot().should.eql([]);
    //    done();
    //});
    //
    //it('should detect a device read error',function(done){
    //    var watcher = new ModemWatcher().start({serialPort: '/dev/null',rssiInterval: 100});
    //    watcher.device.emit('error','test error');
    //    watcher.stop();
    //    test.pp.snapshot().should.eql([
    //        '[modem     ] start watching',
    //        '[modem     ] read error: test error',
    //        '[modem     ] stop watching'
    //    ]);
    //    done();
    //});

});