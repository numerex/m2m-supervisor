var test = require('../test');

var CommandFactory = require(process.cwd() + '/lib/command-factory');

describe('CommandFactory',function() {

    var client = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('then-redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        client = test.mockredis.createClient();
    });

    afterEach(function () {
        test.mockery.deregisterMock('then-redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should detect problems in column headers',function(){
        var factory = new CommandFactory(client);
        test.expect(function() { factory.parseHeader(''); }).to.throw('no key column found');
        test.expect(function() { factory.parseHeader('key\ttypes'); }).to.throw('invalid column name: types');
        test.expect(function() { factory.parseHeader('key\tperiods'); }).to.throw('invalid column name: periods');
        test.expect(function() { factory.parseHeader('key\tattr:test:test'); }).to.throw('too many column name parts: attr:test:test');
        test.expect(function() { factory.parseHeader('key\ttest:test'); }).to.throw('invalid multi-part column name: test:test');
        test.expect(function() { factory.parseHeader('key\tread\tread'); }).to.throw('duplicate column name: read');
    });

    it('should set the label column to the key column if not found',function(){
        var factory = new CommandFactory(client);
        factory.parseHeader('key').should.eql({indices: {key: 0,label: 0},types: {read: {},write: {},attr: {}},options: {},periods: {}});
    });

    it('should handle basic fields',function(){
        var factory = new CommandFactory(client);

        var columns = factory.parseHeader('key\tlabel\tread\tperiod\twrite');
        columns.should.eql({indices: {key: 0,label: 1,read: 2,period: 3,write: 4},types: {read: {},write: {},attr: {}},options: {},periods: {period: 3}});

        var definition = factory.parseDefinition('100\tVALUE\tAT+VALUE?\t60\tAT+VALUE={value:S}\textra',columns);
        definition.should.eql({key: '100',label: 'VALUE',read: 'AT+VALUE?',period: '60',write: 'AT+VALUE={value:S}',periods: {60: ['AT+VALUE?']}});

        definition = factory.parseDefinition('100\tVALUE\tAT+VALUE?\t\tAT+VALUE={value:S}\textra',columns);
        definition.should.eql({key: '100',label: 'VALUE',read: 'AT+VALUE?',write: 'AT+VALUE={value:S}',periods: {}});

        definition = factory.parseDefinition('100\t\t\t60\tAT+VALUE={value:S}\textra',columns);
        definition.should.eql({key: '100',label: '100',period: '60',write: 'AT+VALUE={value:S}',periods: {}});
    });

    it('should handle multi-part fields',function(){
        var factory = new CommandFactory(client);

        var columns = factory.parseHeader('key\tlabel\tread:display\tread:computer\tperiod:computer\twrite:display\twrite:computer\tattr:first\tattr:second');
        columns.should.eql({
            indices: {key: 0,label: 1,'read:display': 2,'read:computer': 3,'period:computer': 4,'write:display': 5,'write:computer': 6,'attr:first': 7,'attr:second': 8},
            types: {read: {display: 2,computer: 3},write: {display: 5,computer: 6},attr: {first: 7,second: 8}},
            options: {first: [],second: []},
            periods: {'period:computer': 4}});

        var definition = factory.parseDefinition('100\tVALUE\tVALUE?\tAT+VALUE?\t60\tVALUE={value:S}\tAT+VALUE={value:S}\t1\t2\textra',columns);
        definition.should.eql({key: '100',label: 'VALUE','read:display': 'VALUE?','read:computer': 'AT+VALUE?','period:computer': '60','write:display': 'VALUE={value:S}','write:computer': 'AT+VALUE={value:S}','attr:first':'1','attr:second':'2',periods: {60: ['AT+VALUE?']}});
        columns.options.should.eql({first: ['1'],second: ['2']});

        definition = factory.parseDefinition('100\tVALUE\tVALUE?\tAT+VALUE?\t\tVALUE={value:S}\tAT+VALUE={value:S}',columns);
        definition.should.eql({key: '100',label: 'VALUE','read:display': 'VALUE?','read:computer': 'AT+VALUE?','write:display': 'VALUE={value:S}','write:computer': 'AT+VALUE={value:S}',periods: {}});
    });

    it('should do nothing if no updates',function(){
        var factory = new CommandFactory(client);
        factory.storeHash('test',{});
    });

    it('should detect an missing file',function(done){
        var factory = new CommandFactory(client);
        factory.loadCommandsTSV('unknown.file1','test');
        factory.loadCommandsTSV('unknown.file2',function(){
            test.pp.snapshot().should.eql([
                '[cmd-fact  ] load file: unknown.file1',
                '[cmd-fact  ] load file error: ENOENT, no such file or directory \'unknown.file1\'',
                '[cmd-fact  ] load file: unknown.file2',
                '[cmd-fact  ] load file error: ENOENT, no such file or directory \'unknown.file2\''
            ]);
            done();
        });
    });

    it('should detect no rows defined',function(){
        var factory = new CommandFactory(client);
        factory.loadCommandsTSV('test-server/data/empty-commands.tsv');
        test.pp.snapshot().should.eql([
            '[cmd-fact  ] load file: test-server/data/empty-commands.tsv',
            '[cmd-fact  ] load commands: empty-commands',
            '[cmd-fact  ] empty-commands - no rows defined'
        ]);
    });

    it('should detect missing keys',function(){
        var factory = new CommandFactory(client);
        factory.loadCommandRows('missingKey',['key','']);
        test.pp.snapshot().should.eql([
            '[cmd-fact  ] load commands: missingKey',
            '[cmd-fact  ] missingKey - missing key (row 2)'
        ]);
    });

    it('should detect duplicate command keys',function(){
        var factory = new CommandFactory(client);
        factory.loadCommandRows('duplicateKey',['key','abc','abc']);
        test.pp.snapshot().should.eql([
            '[cmd-fact  ] load commands: duplicateKey',
            '[cmd-fact  ] duplicateKey - duplicate command key: abc (row 3)'
        ]);
    });

    it('should detect duplicate command keys',function(done){
        var factory = new CommandFactory(client);
        factory.loadCommandRows('duplicateKey',['key\tlabel','abc\tABC','def\tABC'],function(){
            test.pp.snapshot().should.eql([
                '[cmd-fact  ] load commands: duplicateKey',
                '[cmd-fact  ] duplicateKey - duplicate command label: ABC (row 3)'
            ]);
            done();
        });
    });

    it('should process a basic commands file',function(done){
        var factory = new CommandFactory(client);
        factory.loadCommandsTSV('test-server/data/basic-commands.tsv','testKey',function(){
            test.mockredis.snapshot().should.eql([
                {del:'m2m-command:testKey:columns'},
                {del:'m2m-command:testKey:definitions'},
                {hmset:['m2m-command:testKey:columns',
                    'indices',  '{"key":0,"read":1,"period":2,"write":3,"attr:show":4,"label":0}',
                    'types',    '{"read":{},"write":{},"attr":{"show":4}}',
                    'options',  '{"show":["X"]}',
                    'periods',  '{"period":2}'
                ]},
                {hmset:['m2m-command:testKey:definitions',
                    'first',    '{"periods":{"60":["abc"]},"key":"first","read":"abc","period":"60","write":"ABC","attr:show":"X","label":"first"}',
                    'second',   '{"periods":{"60":["def"]},"key":"second","read":"def","period":"60","attr:show":"X","label":"second"}',
                    'third',    '{"periods":{"30":["ghi"]},"key":"third","read":"ghi","period":"30","label":"third"}',
                    'fourth',   '{"periods":{},"key":"fourth","read":"jkl","label":"fourth"}'
                ]},
                {del:'m2m-schedule:testKey:periods'},
                {hmset:['m2m-schedule:testKey:periods','30','["ghi"]','60','["abc","def"]']},
                {hgetall:'m2m-schedule:testKey:periods'}
            ]);
            test.pp.snapshot().should.eql([
                '[cmd-fact  ] load file: test-server/data/basic-commands.tsv',
                '[cmd-fact  ] load commands: testKey'
            ]);
            done();
        });
    })

});