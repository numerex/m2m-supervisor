var _ = require('lodash');
var fs = require('fs');

var schema = require('./redis-schema');
var logger = require('./logger')('sch-fact');

function ScheduleFactory(client){
    this.lastError = null;
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
    var promise = self.client.del(hashKey).errorHint('delSchedules');
    if (args.length > 1) promise = self.client.send('hmset',args).errorHint('addSchedules');
    return self.client.hgetall(hashKey).thenHint('getSchedules',callback);
};

ScheduleFactory.prototype.loadSchedulesFile = function(key,filename,callback){
    try {
        this.lastError = null;
        return this.loadSchedules(key,JSON.parse(fs.readFileSync(filename)),callback);
    } catch(e) {
        this.lastError = e;
        logger.error('load error: ' + e);
        return callback(null);
    }
};

module.exports = ScheduleFactory;