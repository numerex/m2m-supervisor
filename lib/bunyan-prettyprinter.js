var _ = require('lodash');
var Stream = require('stream');
var moment = require('moment');

var names = {};
var maxLength = 0;
var entries = [];

function checkName(name) {
    names[name] = true;
    maxLength = Math.max(maxLength,name.length);
}

module.exports = function(options) {
    var stream = new Stream();
    stream.writable = true;
    stream.write = function(obj) {
        checkName(obj.name);
        var output = '[' + _.padRight(obj.name,maxLength) + '] ' + obj.msg;
        process.env.testing ? entries.push(output) : console.log(moment(obj.time).format('YYYY-MM-DD HH:mm:ss.SSS') + ': ' + output + '\n');
    };

    checkName(options.name);
    options.raw = true;
    options.streams = [{stream: stream,type: 'raw',closeOnExit: false}];
    return options;
};

module.exports.snapshot = function() {
    var result = entries;
    entries = [];
    return result;
};