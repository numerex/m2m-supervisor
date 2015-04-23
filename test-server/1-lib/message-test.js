var test = require('../test');

var m2m = require('m2m-ota-javascript');

describe('Message',function() {

    it('should convert to wire', function () {
        var json = '{"messageType":170,"majorVersion":1,"minorVersion":0,"eventCode":0,"sequenceNumber":44,"timestamp":1429827932564,"tuples":[{"type":2,"id":0,"value":"111100000001174"},{"type":2,"id":10,"value":"test"},{"type":11,"id":11,"value":{"type":"Buffer","data":[1,57,57,57,57,70,70,49,66,3]}}]}';
        var message = new m2m.Message({json: json});
        message.toWire();
    });

});