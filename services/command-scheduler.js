var _ = require('lodash');
var logger = require('../logger')('scheduler');

function CommandScheduler(redis,schedules) {
    this.redis = redis;
    this.queueKey = queueKey;
    this.schedules = schedules;
    this.intervals = [];
}

CommandScheduler.prototype.started = function(){
    return this.intervals.length > 0;
};

CommandScheduler.prototype.start = function(note) {
    if (this.started()) throw(new Error('already started'));

    logger.info('start schedule');

    var self = this;
    self.noteEvent = note || function(){};
    self.enqueueCommandsCallback = function(commands){self.enqueueCommands(commands); };
    _.each(self.schedules,function(schedule){
        self.intervals.push(setInterval(function(){ self.enqueueCommands(schedule.commands); },schedule.period * 1000));
    });
};

CommandScheduler.prototype.stop = function() {
    if (!this.started()) throw(new Error('not started'));

    logger.info('stop schedule');

    while(self.intervals.length > 0)
        clearInterval(this.intervals.pop());
};

CommandScheduler.prototype.enqueueCommands = function(commands){
    var string = JSON.stringify(commands);
    logger.info('enqueue commands: ' + string);
    self.redis.lpush(self.queueKey,string);
    self.noteEvent('commands');
};

module.exports = CommandScheduler;
