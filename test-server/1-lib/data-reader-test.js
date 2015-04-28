var test = require('../test');

var DataReader = require(process.cwd() + '/lib/data-reader');

var TelnetDevice = require(process.cwd() + '/lib/telnet-device');

describe('DataReader',function() {

    var testDevice = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.warnOnUnregistered(false);
        test.mocknet.reset();
        testDevice = new TelnetDevice({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
    });

    afterEach(function () {
        if (testDevice.opened()) testDevice.close();
        test.mockery.deregisterMock('net');
        test.mockery.disable();
        test.mocknet.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var reader = new DataReader(testDevice);
        reader.device.should.eql(testDevice);
        reader.config.should.eql({
            commandPrefix: '\x01',
            commandSuffix: '\x03',
            responsePrefix: '\x01',
            responseSuffix: '\x03'
        });
    });

    it('should properly initialize data with all arguments, started, and stopped',function(){
        var reader = new DataReader(testDevice,{
            commandPrefix: 'A',
            commandSuffix: 'B',
            responsePrefix: 'C',
            responseSuffix: 'D'
        });
        reader.device.should.eql(testDevice);
        reader.config.should.eql({
            commandPrefix: 'A',
            commandSuffix: 'B',
            responsePrefix: 'C',
            responseSuffix: 'D'
        });
        reader.started().should.not.be.ok;
        reader.ready().should.not.be.ok;
        reader.start();
        reader.started().should.be.ok;
        reader.ready().should.be.ok;
        reader.stop();
        reader.started().should.not.be.ok;
        reader.ready().should.not.be.ok;
        test.mocknet.snapshot().should.eql([
            {connect: {host: 'host',port: 1234}},
            {end: null}
        ]);
        test.pp.snapshot().should.eql([
            '[reader    ] start watching',
            '[reader    ] stop watching'
        ]);
    });

    it('should retry if the device is not ready',function(done){
        test.mocknet.connectException = 'test error';

        var count = 0;
        var reader = new DataReader(testDevice);
        reader.on('retry',function(error){
            error.should.eql('Error: test error');
            if (count++ > 0) {
                reader.stop();
                test.pp.snapshot().should.eql([
                    '[reader    ] start watching',
                    '[reader    ] start error: Error: test error',
                    '[reader    ] start error: Error: test error',
                    '[reader    ] stop watching'
                ]);
                done();
            }
        });
        reader.start();
    });

    it('should capture an error event',function(done){
        var reader = new DataReader(testDevice);
        reader.on('error',function(error){
            error.should.eql('Error: test error');
            reader.stop();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] read error: Error: test error',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
        reader.device.client.events.error(new Error('test error'));
    });

    it('should capture a skipped data event',function(done){
        var events = [];
        var reader = new DataReader(testDevice);
        reader.on('note',function(event){
            events.push(event);
            if (event !== 'skip') return;

            reader.stop();
            events.should.eql(['ready','skip']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] data skipped: test',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
        reader.device.client.events.data(new Buffer('test'));
    });

    it('should capture a single, complete data event',function(done){
        var events = [];
        var reader = new DataReader(testDevice,{responsePrefix: '0',responseSuffix: '1'});
        reader.on('note',function(event){
            events.push(event);
            if (event !== 'response') return;

            reader.stop();
            events.should.eql(['ready','response']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] response: "0test1"',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
        reader.device.client.events.data(new Buffer('0test1'));
    });

    it('should capture a multiple pieces of a data event',function(done){
        var events = [];
        var reader = new DataReader(testDevice,{responsePrefix: '0',responseSuffix: '1'});
        reader.on('note',function(event){
            events.push(event);
            if (event !== 'response') return;

            reader.stop();
            events.should.eql(['ready','begin','middle','response']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] response: "0abc1"',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
        reader.device.client.events.data(new Buffer('0a'));
        reader.device.client.events.data(new Buffer('b'));
        reader.device.client.events.data(new Buffer('c1'));
    });

    it('should not allow submitting command when the device is not ready',function(done){
        var reader = new DataReader(testDevice);
        reader.submit('test command',function(error,command,response){
            [error,command,response].should.eql(['not ready',null,null]);
            done();
        })
    });

    it('should provide a response to a submitted command',function(done){
        var reader = new DataReader(testDevice,{commandPrefix: 'A',commandSuffix: 'B',responsePrefix: '0',responseSuffix: '1'});
        reader.start();
        reader.submit('test-command',function(error,command,response){
            [error,command,response].should.eql([null,'test-command','0test1']);
            reader.stop();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {write: 'Atest-commandB'},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] command: "test-command"',
                '[reader    ] response: "0test1"',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.device.client.events.data(new Buffer('0test1'));
    });

    it('should capture an error on writing',function(done){
        test.mocknet.writeException = 'test error';

        var reader = new DataReader(testDevice,{commandPrefix: 'A',commandSuffix: 'B',responsePrefix: '0',responseSuffix: '1'});
        reader.start();
        reader.submit('test-command',function(error,command,response){
            [error,command,response].should.eql(['Error: test error',null,null]);
            reader.stop();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] command: "test-command"',
                '[reader    ] write error: Error: test error',
                '[reader    ] stop watching'
            ]);
            done();
        });
    });

});
