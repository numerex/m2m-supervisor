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
        watcher.start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
        watcher.started().should.be.ok;
        watcher.ready().should.be.ok;
        watcher.stop();
        watcher.started().should.not.be.ok;
        watcher.ready().should.not.be.ok;
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
            {open: null},
            {write: 'AT E1\r'},
            {write: 'AT+CSQ\r'},
            {close: null}
        ]);
        test.pp.snapshot().should.eql([
            '[modem     ] start watching',
            '[modem     ] stop watching']);
        done();
    });

    it('should throw an error if start called twice',function(done){
        var watcher = new ModemWatcher()
            .on('note',noteEvents)
            .start({serialPort: '/dev/ttyUSB2'});
        expectEvents = ['ready'];
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
            {open: null},
            {write: 'AT E1\r'},
            {write: 'AT+CSQ\r'},
            {close: null}
        ]);
        test.pp.snapshot().should.eql([
            '[modem     ] start watching',
            '[modem     ] stop watching']);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new ModemWatcher();
        watcher.on('note',noteEvents);
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should detect a device read error',function(done){
        var watcher = new ModemWatcher().start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
        watcher.device.emit('error',new Error('test error'));
        watcher.stop();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
            {open: null},
            {write: 'AT E1\r'},
            {write: 'AT+CSQ\r'},
            {close: null}
        ]);
        test.pp.snapshot().should.eql([
            '[modem     ] start watching',
            '[modem     ] read error: test error',
            '[modem     ] stop watching'
        ]);
        done();
    });

    it('should detect a device write error',function(done){
        test.mockserialport.writeException = 'test error';

        var watcher = new ModemWatcher().start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
        watcher.requestRSSI();
        watcher.stop();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
            {open: null},
            {close: null}
        ]);
        test.pp.snapshot().should.eql([
            '[modem     ] start watching',
            '[modem     ] request error: test error',
            '[modem     ] request error: test error',
            '[modem     ] stop watching'
        ]);
        done();
    });

    it('should detect an RSSI format error',function(done){
        var watcher = new ModemWatcher().start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
        watcher.noteRSSI('abc');
        watcher.stop();
        test.mockserialport.snapshot().should.eql([
            {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
            {open: null},
            {write: 'AT E1\r'},
            {write: 'AT+CSQ\r'},
            {close: null}
        ]);
        test.pp.snapshot().should.eql([
            '[modem     ] start watching',
            '[modem     ] RSSI:abc',
            '[modem     ] rssi error: invalid value',
            '[modem     ] stop watching'
        ]);
        done();
    });

    it('should retry if the serial port is not avaiable',function(done){
        test.mockserialport.connectException = 'test error';

        var count = 0;
        var watcher = new ModemWatcher({retryInterval: 10});
        watcher.on('note',function(event){
            if (event === 'retry' && count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[modem     ] start watching',
                    '[modem     ] retry: test error',
                    '[modem     ] retry: test error',
                    '[modem     ] stop watching'
                ]);
                done();
            }
        });
        watcher.start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
    });

    it('should check for RSSI when ready',function(done){
        var watcher = new ModemWatcher({serialPort: '/dev/ttyUSB2',retryInterval: 10});
        watcher.on('requestRSSI',function(){
            test.mockserialport.events.data('\r\n\r\n');
            test.mockserialport.events.data('\r\nGARBAGE\r\n');
            test.mockserialport.events.data('\r\n\r\n+CSQ: 19,99\r\n');
            watcher.stop();
            test.mockserialport.snapshot().should.eql([
                {create: ['/dev/ttyUSB2',{baudrate: NaN},false]},
                {open: null},
                {write: 'AT E1\r'},
                {write: 'AT+CSQ\r'},
                {close: null}
            ]);
            test.pp.snapshot().should.eql([
                '[modem     ] start watching',
                '[modem     ] RSSI: 19,99',
                '[modem     ] stop watching'
            ]);
            done();
        });
        watcher.start({serialPort: '/dev/ttyUSB2',rssiInterval: 100 / ModemWatcher.MILLIS_PER_SEC});
    });

});