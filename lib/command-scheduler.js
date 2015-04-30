var _ = require('lodash');
var util = require('util');

var Watcher = require('./watcher');

var logger = require('./logger')('scheduler');

function CommandScheduler(queueKey,schedules) {
    Watcher.apply(this,[logger,{qualifier: queueKey},true]);
    this.queueKey = queueKey;
    this.schedules = schedules;
    this.intervals = [];
}

util.inherits(CommandScheduler,Watcher);

CommandScheduler.prototype._onStart = function(client) {
    var self = this;
    self.client = client;
    _.each(self.schedules,function(commands,period){
        if (commands = self.safeParseJSON(commands)) {
            var intervalCallback = _.bind(self.processSchedule,self,+period,commands);
            intervalCallback();
            self.intervals.push(setInterval(intervalCallback,+period * 1000));
        }
    });
};

CommandScheduler.prototype._onStop = function() {
    while(self.intervals.length > 0)
        clearInterval(this.intervals.pop());
};

CommandScheduler.prototype.processSchedule = function(period,commands){
    var self = this;
    var promise = null;
    logger.info('schedule[' + period + ']: ' + commands);
    _.each(commands,function(command){
        promise = self.client.lpush(self.queueKey,JSON.stringify({command: command}));
    });
    if (promise){
        promise.errorHint('processSchedule').done();
        self.emit('schedule');
    }
};

CommandScheduler.prototype.safeParseJSON = function(contents) {
    try {
        return JSON.parse(contents);
    } catch(e) {
        logger.error('json error: ' + e);
        this.emit('note','error');
        return null;
    }
};

module.exports = CommandScheduler;
