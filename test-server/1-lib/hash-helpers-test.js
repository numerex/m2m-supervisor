var test = require('../test');

var helpers = require(process.cwd() + '/lib/hash-helpers');

describe('HashHelpers',function() {

    var hashkeys = {
        numbers: {
            defaultedNumber: {
                label: 'Defaulted Number',
                key: 'defaulted-number',
                type: 'number',
                default: 1
            },
            requiredNumberWithDefault: {
                label: 'Required Number With Default',
                key: 'required-number-with-default',
                type: 'number',
                default: 2,
                required: true
            },
            requiredNumberNoDefault: {
                label: 'Required Number No Default',
                key: 'required-number-no-default',
                type: 'number',
                required: true
            }
        },
        strings: {
            defaultedString: {
                label: 'Defaulted String',
                key: 'defaulted-string',
                type: 'string',
                default: 'test1'
            },
            requiredStringWithDefault: {
                label: 'Required String With Default',
                key: 'required-string-with-default',
                type: 'string',
                default: 'test2',
                required: true
            },
            requiredStringNoDefault: {
                label: 'Required String No Default',
                key: 'required-string-no-default',
                type: 'string',
                required: true
            }
        }
    };
 
    it('hash2config provides defaults',function(){
        helpers.hash2config({},hashkeys.numbers).should.eql({
            defaultedNumber: 1,
            requiredNumberWithDefault: 2,
            requiredNumberNoDefault: NaN
        });
        helpers.hash2config({},hashkeys.strings).should.eql({
            defaultedString: 'test1',
            requiredStringWithDefault: 'test2',
            requiredStringNoDefault: undefined
        });
    });

    it('hash2config accepts numbers as string',function(){
        var numbers = {
            'defaulted-number': '10',
            'required-number-with-default': '20',
            'required-number-no-default': '30'
        };
        helpers.hash2config(numbers,hashkeys.numbers).should.eql({
            defaultedNumber: 10,
            requiredNumberWithDefault: 20,
            requiredNumberNoDefault: 30
        });
    });

    it('hash2config accepts string values as-is',function(){
        var strings = {
            'defaulted-string': 'test10',
            'required-string-with-default': 'test20',
            'required-string-no-default': 'test30'
        };
        helpers.hash2config(strings,hashkeys.strings).should.eql({
            defaultedString: 'test10',
            requiredStringWithDefault: 'test20',
            requiredStringNoDefault: 'test30'
        });
    });
    
    it('requirements return keys for required fields with no default',function(){
        helpers.requirements(hashkeys.numbers).should.eql(['required-number-no-default']);
        helpers.requirements(hashkeys.strings).should.eql(['required-string-no-default']);
    });

    it('hash2groups provides defaults',function(){
        var values = {
            'defaulted-number': '10',
            'required-number-with-default': '20',
            'required-number-no-default': '30',
            'defaulted-string': 'test10',
            'required-string-with-default': 'test20',
            'required-string-no-default': 'test30'
        };

        helpers.hash2groups(values,hashkeys).should.eql({
            Numbers: [
                {
                    default: 1,
                    key: "defaulted-number",
                    label: "Defaulted Number",
                    type: "number",
                    value: 10,
                    exists: true
                },
                {
                    default: 2,
                    key: "required-number-with-default",
                    label: "Required Number With Default",
                    required: true,
                    type: "number",
                    value: 20,
                    exists: true
                },
                {
                    key: "required-number-no-default",
                    label: "Required Number No Default",
                    required: true,
                    type: "number",
                    value: 30,
                    exists: true
                }
            ],
            Strings: [
                {
                    default: "test1",
                    key: "defaulted-string",
                    label: "Defaulted String",
                    type: "string",
                    value: 'test10',
                    exists: true
                },
                {
                    default: "test2",
                    key: "required-string-with-default",
                    label: "Required String With Default",
                    required: true,
                    type: "string",
                    value: 'test20',
                    exists: true
                },
                {
                    key: "required-string-no-default",
                    label: "Required String No Default",
                    required: true,
                    type: "string",
                    value: 'test30',
                    exists: true
                }
            ]
        });
    });

    it('hash2groups accepts values',function(){
        helpers.hash2groups({},hashkeys).should.eql({
            Numbers: [
                {
                    default: 1,
                    key: "defaulted-number",
                    label: "Defaulted Number",
                    type: "number"
                },
                {
                    default: 2,
                    key: "required-number-with-default",
                    label: "Required Number With Default",
                    required: true,
                    type: "number"
                },
                {
                    key: "required-number-no-default",
                    label: "Required Number No Default",
                    required: true,
                    type: "number"
                }
            ],
            Strings: [
                {
                    default: "test1",
                    key: "defaulted-string",
                    label: "Defaulted String",
                    type: "string"
                },
                {
                    default: "test2",
                    key: "required-string-with-default",
                    label: "Required String With Default",
                    required: true,
                    type: "string"
                },
                {
                    key: "required-string-no-default",
                    label: "Required String No Default",
                    required: true,
                    type: "string"
                }
            ]
        });
    });

});