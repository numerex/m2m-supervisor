var _ = require('lodash');
var test = require('../test');

var DataReader = require(process.cwd() + '/lib/data-reader');

var TelnetPeripheral = require(process.cwd() + '/lib/telnet-peripheral');

describe('DataReader',function() {

    var testPeripheral = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('net', test.mocknet);
        test.mockery.warnOnUnregistered(false);
        test.mocknet.reset();
        testPeripheral = new TelnetPeripheral({telnetAddress: 'host',telnetPort: '1234',retryInterval: 1});
    });

    afterEach(function () {
        if (testPeripheral.opened()) testPeripheral.close();
        test.mockery.deregisterMock('net');
        test.mockery.disable();
        test.mocknet.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var reader = new DataReader(testPeripheral);
        reader.peripheral.should.eql(testPeripheral);
        reader.config.should.eql({
            commandPrefix: '',
            commandSuffix: '',
            responsePrefix: '',
            responseSuffix: ''
        });
    });

    it('should detect invalid eval strings',function(){
        var reader = new DataReader(testPeripheral,{commandPrefix: '"'});
        reader.peripheral.should.eql(testPeripheral);
        reader.config.should.eql({
            commandPrefix: '',
            commandSuffix: '',
            responsePrefix: '',
            responseSuffix: ''
        });
        test.pp.snapshot().should.eql(['[reader    ] JSON string contents expected: "'])
    });

    it('should properly initialize data with all arguments, started, and stopped',function(done){
        var reader = new DataReader(testPeripheral,{
            commandPrefix: 'A',
            commandSuffix: 'B',
            responsePrefix: 'C',
            responseSuffix: 'D'
        });
        reader.peripheral.should.eql(testPeripheral);
        reader.config.should.eql({
            commandPrefix: 'A',
            commandSuffix: 'B',
            responsePrefix: 'C',
            responseSuffix: 'D'
        });
        reader.started().should.not.be.ok;
        reader.ready().should.not.be.ok;
        reader.start();
        _.defer(function(){
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
                '[reader    ] ready',
                '[reader    ] stop watching'
            ]);
            done();
        });
    });

    it('should retry if the peripheral is not ready',function(done){
        test.mocknet.connectException = 'test error';

        var count = 0;
        var reader = new DataReader(testPeripheral);
        reader.on('error',function(error){
            console.log(error);
        });
        reader.on('retry',function(error){
            error.should.eql(new Error('test error'));
            if (count++ > 0) {
                reader.stop();
                test.pp.snapshot().should.eql([
                    '[reader    ] start watching',
                    '[reader    ] retry: test error',
                    '[reader    ] retry: test error',
                    '[reader    ] stop watching'
                ]);
                test.mocknet.snapshot().should.eql([
                    {end: null}
                ]);
                done();
            }
        });
        reader.start();
    });

    it('should capture an error event',function(done){
        var reader = new DataReader(testPeripheral);
        reader.on('ready',function(){
            reader.peripheral.client.events.error(new Error('test error'));
        });
        reader.on('error',function(error){
            error.should.eql(new Error('test error'));
            reader.stop();
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] ready',
                '[reader    ] read error: test error',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
    });

    it('should capture a skipped data event',function(done){
        var events = [];
        var reader = new DataReader(testPeripheral);
        reader.on('note',function(event){
            events.push(event);
            if (event === 'ready') reader.peripheral.client.events.data(new Buffer('test'));
            if (event !== 'skip') return;

            reader.stop();
            events.should.eql(['ready','skip']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] ready',
                '[reader    ] data skipped: test',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
    });

    it('should capture a single, complete data event',function(done){
        var events = [];
        var reader = new DataReader(testPeripheral,{responsePrefix: '0',responseSuffix: '1'});
        reader.on('note',function(event){
            events.push(event);
            if (event === 'ready') reader.peripheral.client.events.data(new Buffer('0test1'));
            if (event !== 'response') return;

            reader.stop();
            events.should.eql(['ready','response']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] ready',
                '[reader    ] response: "0test1"',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
    });

    it('should capture a multiple pieces of a data event',function(done){
        var events = [];
        var reader = new DataReader(testPeripheral,{responsePrefix: '0',responseSuffix: '1'});
        reader.on('note',function(event){
            events.push(event);

            if (event === 'ready') {
                reader.peripheral.client.events.data(new Buffer('0a'));
                reader.peripheral.client.events.data(new Buffer('b'));
                reader.peripheral.client.events.data(new Buffer('c1'));
            }

            if (event !== 'response') return;

            reader.stop();
            events.should.eql(['ready','begin','middle','response']);
            test.mocknet.snapshot().should.eql([
                {connect: {host: 'host',port: 1234}},
                {end: null}
            ]);
            test.pp.snapshot().should.eql([
                '[reader    ] start watching',
                '[reader    ] ready',
                '[reader    ] response: "0abc1"',
                '[reader    ] stop watching'
            ]);
            done();
        });
        reader.start();
    });

    it('should not allow submitting command when the peripheral is not ready',function(done){
        var reader = new DataReader(testPeripheral);
        reader.submit('test command',function(error,command,response){
            [error,command,response].should.eql(['not ready',null,null]);
            done();
        })
    });

    it('should provide a response to a submitted command',function(done){
        var reader = new DataReader(testPeripheral,{commandPrefix: 'A',commandSuffix: 'B',responsePrefix: '0',responseSuffix: '1'});
        reader.on('ready',function(){
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
                    '[reader    ] ready',
                    '[reader    ] command: "test-command"',
                    '[reader    ] response: "0test1"',
                    '[reader    ] stop watching'
                ]);
                done();
            });
            reader.peripheral.client.events.data(new Buffer('0test1'));
        });
        reader.start();
    });

    it('should capture an error on writing',function(done){
        test.mocknet.writeException = 'test error';

        var reader = new DataReader(testPeripheral,{commandPrefix: 'A',commandSuffix: 'B',responsePrefix: '0',responseSuffix: '1'});
        reader.on('ready',function(){
            reader.submit('test-command',function(error,command,response){
                [error,command,response].should.eql([new Error('test error'),null,null]);
                reader.stop();
                test.mocknet.snapshot().should.eql([
                    {connect: {host: 'host',port: 1234}},
                    {end: null}
                ]);
                test.pp.snapshot().should.eql([
                    '[reader    ] start watching',
                    '[reader    ] ready',
                    '[reader    ] command: "test-command"',
                    '[reader    ] write error: test error',
                    '[reader    ] stop watching'
                ]);
                done();
            });
        });
        reader.start();
    });

});
