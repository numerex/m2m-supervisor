var fs = require('fs');
var test = require('../test');
var RouteWatcher = require(process.cwd() + '/lib/route-watcher');

describe('RouteWatcher',function(){

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('lynx',test.mocklynx);
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockshelljs.reset();
        test.mockery.warnOnUnregistered(false);
        //test.mockery.registerAllowables([process.cwd() + '/config/ppp','./statsd','path']);
        //test.pp.snapshot();
    });

    afterEach(function() {
        test.mockery.deregisterMock('shelljs');
        test.mockery.deregisterMock('lynx');
        test.mockery.disable();
    });

    it('should be immediately stopped',function(done){
        var watcher = new RouteWatcher().start();
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[route    ] start watcher',
            '[route    ] pppstats error: Error: no response found: pppstats',
            '[route    ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}]);
        done();
    });

    it('should throw an error if start called twice',function(done){
        var count = 0;
        var watcher = new RouteWatcher().start(function(event){ count++; });
        count.should.equal(1);
        test.expect(function(){ watcher.start(); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[route    ] start watcher',
            '[route    ] pppstats error: Error: no response found: pppstats',
            '[route    ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'error'},
            {increment: 'stopped'}]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new RouteWatcher();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        done();
    });

    it('should start pppd if it is not found',function(done){
        test.mockshelljs.lookup['pppstats'] = [1,"pppstats: nonexistent interface 'ppp0' specified"];
        test.mockshelljs.lookup['pppd']     = [0,''];

        var watcher = new RouteWatcher().start(function(event){
            event.should.equal('pppd');
        });
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[route    ] start watcher',
            '[route    ] starting pppd',
            '[route    ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'start-pppd'},
            {increment: 'stopped'}]);
        done();
    });

    it('should add ppp route if it is not found',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-no-ppp.txt').toString()];
        test.mockshelljs.lookup['route add -net 172.29.12.0 netmask 255.255.255.0 dev ppp0'] = [0,''];

        var watcher = new RouteWatcher().start(function(event){
            event.should.equal('route');
        });
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[route    ] start watcher',
            '[route    ] add ppp route to GWaaS',
            '[route    ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'add-route'},
            {increment: 'stopped'}]);
        done();
    });

    it('should detect an existing ppp route and do nothing',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-includes-ppp.txt').toString()];

        var watcher = new RouteWatcher().start(function(event){
            event.should.equal('ready');
        });
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[route    ] start watcher',
            '[route    ] stop watcher']);
        test.mocklynx.snapshot().should.eql([
            {increment: 'started'},
            {increment: 'stopped'}]);
        done();
    });

    it('should detect failed response from route',function(done){
        var watcher = new RouteWatcher();

        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [1,null];
        watcher.checkRoutes(function(event){
            event.should.eql('error');
            test.pp.snapshot().should.eql([]);
            test.mocklynx.snapshot().should.eql([{ increment: 'error' }]);
            done();
        });
    });

    it('should check routes at intervals',function(done){
        var count = 0;
        var watcher = new RouteWatcher({routeInterval: 1}).start(function(event){
            if (count++ > 0) {
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[route    ] start watcher',
                    '[route    ] pppstats error: Error: no response found: pppstats',
                    '[route    ] pppstats error: Error: no response found: pppstats',
                    '[route    ] stop watcher']);
                test.mocklynx.snapshot().should.eql([
                    {increment: 'started'},
                    {increment: 'error'},
                    {increment: 'error'},
                    {increment: 'stopped'}]);
                done();
            }
        });
    });

    it('should allow caching of shell responses',function() {
        var count = 0;
        var watcher = new RouteWatcher();

        test.mockshelljs.lookup['test'] = [0,'first'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([null,'first']);
            count++;
        });

        test.mockshelljs.lookup['test'] = [0,'second'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([null,'second']);
            count++;
        });

        test.mockshelljs.lookup['test'] = [0,'third'];
        watcher.getShellOutput('test','test',false,function(err,output) {
            [err,output].should.eql([null,'second']);
            count++;
        });

        count.should.equal(3);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect unexpected responses for pppstats',function(done){
        var watcher = new RouteWatcher();

        test.mockshelljs.lookup['pppstats'] = [0,'unexpected'];
        watcher.checkRoutes(function(event){
            event.should.eql('error');
            test.pp.snapshot().should.eql(['[route    ] unexpected pppstats output: unexpected']);
            done();
        });
    });

    it('should detect failed shell responses',function(done){
        var watcher = new RouteWatcher();

        test.mockshelljs.lookup['test'] = [1,'first'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([1,'first']);
            test.pp.snapshot().should.eql([]);
            done();
        });
    });
});