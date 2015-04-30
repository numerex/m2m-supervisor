var _ = require('lodash');
var fs = require('fs');

var schema = require('./redis-schema');
var logger = require('./logger')('sch-fact');

function ScheduleFactory(client){
    this.client = client;
}

ScheduleFactory.prototype.loadSchedules = function(key,schedules,callback){
    var self = this;
    var hashKey = schema.schedule.periods.useParam(key);
    var args = [hashKey];
    _.each(schedules,function(schedule){
        args.push(schedule.period);
        args.push(JSON.stringify(schedule.commands));
    });
    self.client.del(hashKey).errorHint('delSchedules');
    if (args.length > 1) self.client.send('hmset',args).errorHint('addSchedules');
    return self.client.hgetall(hashKey).thenHint('getSchedules',callback);
};

ScheduleFactory.prototype.loadSchedulesFile = function(key,filename,callback){
    try {
        return this.loadSchedules(key,JSON.parse(fs.readFileSync(filename)),callback);
    } catch(e) {
        logger.error('load error: ' + e);
        return callback(null);
    }
};

ScheduleFactory.prototype.exportSchedules = function(key,callback){
    var self = this;
    var hashKey = schema.schedule.periods.useParam(key);
    return self.client.hgetall(hashKey).thenHint('exportSchedules',function(hash){
        var result = [];
        _.each(hash || {},function(value,key){ result.push({period: +key,commands: JSON.parse(value)}); });
        callback(result);
    });
};

ScheduleFactory.prototype.exportSchedulesFile = function(key,filename,callback) {
    return this.exportSchedules(key,function(schedules){ fs.writeFile(filename,JSON.stringify(schedules),callback); });
};

module.exports = ScheduleFactory;