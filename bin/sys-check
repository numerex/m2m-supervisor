#!/usr/bin/env node

var _ = require('lodash');

var SystemChecker = require('../lib/system-checker');

var checker = new SystemChecker(process.argv.length > 2 && _.startsWith(process.argv[2],'v'))
    .on('ready',function(){
        var existKeys = _.keys(checker.exists);
        var choiceKeys = _.keys(checker.choices);
        var infoKeys = _.keys(checker.info);
        var maxLength = _.max(_.map(_.union(existKeys,choiceKeys,infoKeys),function(string){ return string.length; })) + 3;
        _.each(existKeys, function(key){ console.log(_.padRight(key,maxLength,'.') + checker.exists[key]); });
        _.each(choiceKeys,function(key){ console.log(_.padRight(key,maxLength,'.') + checker.choices[key]); });
        _.each(infoKeys,  function(key){ console.log(_.padRight(key,maxLength,'.') + checker.info[key]); });
    })
    .checkNow();
