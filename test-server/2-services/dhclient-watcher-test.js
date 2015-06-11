var _ = require('lodash');
var test = require('../test');
var DhclientWatcher = require(process.cwd() + '/services/dhclient-watcher');

describe('DhclientWatcher',function(){

    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockery.registerMock('os',test.mockos);
        test.mockshelljs.reset();
        test.mockos.reset();
        test.mockery.warnOnUnregistered(false);
    });

    afterEach(function() {
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('os');
        test.mockery.disable();
        test.mockshelljs.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should be immediately stopped',function(done){
        var watcher = new DhclientWatcher().start();
        watcher.ready().should.not.be.ok;
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[dhclient  ] start watching',
            '[dhclient  ] ps aux error: Error: no response found: ps aux',
            '[dhclient  ] stop watching']);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if start called twice',function(done){
        var count = 0;
        var watcher = new DhclientWatcher()
            .on('note',function(){ count++; })
            .start();
        count.should.equal(1);
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[dhclient  ] start watching',
            '[dhclient  ] ps aux error: Error: no response found: ps aux',
            '[dhclient  ] stop watching']);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new DhclientWatcher();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should detect a failure of dhclient',function(done){
        test.mockshelljs.lookup['ps aux'] = [0,'something'];
        test.mockshelljs.lookup['dhclient -v eth0']   = [1,''];

        var watcher = new DhclientWatcher();
        watcher.on('note',function(event){
            event.should.eql('error');
            watcher.ready().should.not.be.ok;
            watcher.stop();
            test.pp.snapshot().should.eql([
                '[dhclient  ] start watching',
                '[dhclient  ] starting dhclient',
                '[dhclient  ] dhclient error: 1',
                '[dhclient  ] stop watching']);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
        watcher.start();
    });

    it('should start dhclient if it is not found',function(done){
        test.mockshelljs.lookup['ps aux'] = [0,'something'];
        test.mockshelljs.lookup['dhclient -v eth0']   = [0,''];

        var watcher = new DhclientWatcher();
        watcher.on('note',function(event){
            event.should.eql('dhclient');
            watcher.ready().should.not.be.ok;
            watcher.stop();
            test.pp.snapshot().should.eql([
                '[dhclient  ] start watching',
                '[dhclient  ] starting dhclient',
                '[dhclient  ] stop watching']);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
        watcher.start();
    });

    it('should check routes at intervals',function(done){
        test.mockshelljs.lookup['ps aux'] = [0,'something'];
        test.mockshelljs.lookup['dhclient -v eth0']   = [0,''];

        var count = 0;
        var watcher = new DhclientWatcher({checkInterval: 10}).on('note',function(event){
            if (count++ > 0) {
                watcher.ready().should.not.be.ok;
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[dhclient  ] start watching',
                    '[dhclient  ] starting dhclient',
                    '[dhclient  ] starting dhclient',
                    '[dhclient  ] stop watching']);
                test.mockshelljs.snapshot(); // clear snapshot
                done();
            }
        }).start();
    });

    it('should detect the (unlikely) event of ps failure',function(done){
        test.mockshelljs.lookup['ps aux'] = [1,null];

        var count = 0;
        var watcher = new DhclientWatcher({checkInterval: 1}).on('note',function(note){
            if (count++ > 0) {
                watcher.ready().should.not.be.ok;
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[dhclient  ] start watching',
                    '[dhclient  ] ps aux error: 1',
                    '[dhclient  ] ps aux error: 1',
                    '[dhclient  ] stop watching']);
                test.mockshelljs.snapshot(); // clear snapshot
                done();
            }
        }).start();
    });

    it('should detect dhclient running but no interface yet',function(done){
        test.mockshelljs.lookup['ps aux'] = [0,'dhclient'];

        var count = 0;
        var watcher = new DhclientWatcher({checkInterval: 1}).on('note',function(event){
            if (count++ > 0) {
                watcher.ready().should.not.be.ok;
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[dhclient  ] start watching',
                    '[dhclient  ] waiting for dhclient',
                    '[dhclient  ] waiting for dhclient',
                    '[dhclient  ] stop watching']);
                test.mockshelljs.snapshot(); // clear snapshot
                done();
            }
        }).start();
    });

    it('should allow caching of shell responses',function(done) {
        var count = 0;
        var watcher = new DhclientWatcher();

        test.mockshelljs.lookup['test'] = [0,'first'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([null,'first']);
            count++;

            test.mockshelljs.lookup['test'] = [0,'second'];
            watcher.getShellOutput('test','test',true,function(err,output) {
                [err,output].should.eql([null,'second']);
                count++;

                test.mockshelljs.lookup['test'] = [0,'third'];
                watcher.getShellOutput('test','test',false,function(err,output) {
                    [err,output].should.eql([null,'second']);
                    count++;

                    count.should.equal(3);
                    test.pp.snapshot().should.eql([]);
                    test.mockshelljs.snapshot(); // clear snapshot
                    done();
                });
            });
        });
    });

    it('should detect failed shell responses',function(done){
        test.mockshelljs.lookup['test'] = [1,'first'];

        var watcher = new DhclientWatcher();
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([1,'first']);
            test.pp.snapshot().should.eql([]);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
    });
});