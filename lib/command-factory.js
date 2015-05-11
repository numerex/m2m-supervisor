var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var ScheduleFactory = require('./schedule-factory');

var helpers = require('./hash-helpers');
var schema = require('./redis-schema');
var logger = require('./logger')('cmd-fact');

function CommandFactory(client){
    this.client = client;
}

CommandFactory.prototype.loadCommandsTSV = function(filename,callback){
    try{
        logger.info('load file: ' + filename);

        var data = fs.readFileSync(filename);
        var rows = data.toString().split('\n');
        this.loadCommandRows(path.basename(filename,path.extname(filename)),rows,callback);
    } catch(e){
        logger.error('load file error: ' + e.message);
        callback && callback(null);
    }
};

CommandFactory.prototype.loadCommandRows = function(commandKey,rows,callback){
    var self = this;
    try {
        if (rows.length <= 1) throw(new Error('no rows defined'));

        var header = null;
        var lineOffset = 1;
        var profile = {name: commandKey};
        while (header = rows.shift()) {
            lineOffset++;
            if (!_.startsWith(header,'#')) break;

            var parts = header.split('\t');
            var key = parts[0].substring(1);
            var value = _.trim(parts[1]);
            if (key !== '' && value !== '') profile[key] = value;
        }

        commandKey = profile.name;
        logger.info('load commands: ' + commandKey);

        var columns = self.parseHeader(header);
        var labels = {};
        var periods = {};
        var definitions = {};

        _.each(rows,function(row,index){
            var definition = self.parseDefinition(row,columns);

            if (!definition.key) throw(new Error('missing key (row ' + (index + lineOffset) + ')'));

            if (definitions[definition.key]) throw(new Error('duplicate command key: ' + definition.key + ' (row ' + (index + lineOffset) + ')'));
            definitions[definition.key] = definition;

            if (labels[definition.label]) throw(new Error('duplicate command label: ' + definition.label + ' (row ' + (index + lineOffset) + ')'));
            labels[definition.label] = definition.key;

            _.each(definition.periods,function(commands,period){
                periods[period] = _.union(periods[period] || [],commands);
            });
        });

        var profileKey = schema.command.profile.useParam(commandKey);
        var optionsKey = schema.command.options.useParam(commandKey);
        var definitionsKey = schema.command.definitions.useParam(commandKey);

        self.client.del(profileKey).errorHint('delProfile');
        self.client.del(optionsKey).errorHint('delOptions');
        self.client.del(definitionsKey).thenHint('delDefinitions',function(){
            self.storeHash(profileKey,profile);
            self.storeHash(optionsKey,columns.options);
            self.storeHash(definitionsKey,definitions);
            var schedules = _.map(periods,function(commands,period) { return {period: period,commands: commands}; });
            new ScheduleFactory(self.client).loadSchedules(commandKey,schedules,callback);
        });

    } catch(e){
        logger.error(commandKey + ' - ' + e.message);
        callback && callback(null)
    }
};

CommandFactory.prototype.parseHeader = function(header){
    var columns = {indices: {},options: {},periods: {}};

    _.each(header.split('\t'),function(value,index){

        if (!_.isUndefined(columns.indices[value])) throw(new Error('duplicate column name: ' + value));
        columns.indices[value] = index;

        if (_.startsWith(value,'period')) columns.periods[value] = index;

        var parts = value.split(':');
        if (parts.length > 2) throw(new Error('too many column name parts: ' + value));

        if (parts.length > 1)
            switch(parts[0]){
                case 'read':
                case 'write':
                    columns.options.command = _.union(columns.options.command,[parts[1]]);
                    break;
                case 'attr':
                    if (parts[1] === 'command') throw(new Error('invalid attribute type: command'));
                    columns.options[parts[1]] = [];
                    break;
                case 'period':
                    break;
                default:
                    throw(new Error('invalid multi-part column name: ' + value));
            }
    });

    if (_.isUndefined(columns.indices.key)) throw(new Error('no key column found'));
    if (_.isUndefined(columns.indices.label)) columns.indices.label = columns.indices.key;

    return columns;
};

CommandFactory.prototype.parseDefinition = function(row,columns){
    var definition = {periods: {}};
    var rowParts = row.split('\t');

    _.each(columns.indices,function(index,field){
        var value = rowParts[index];

        if (_.indexOf(['key','label'],field) >= 0) value = _.trim(value);
        if (_.isUndefined(value) || value === '') return;

        definition[field] = value;

        var fieldParts = field.split(':');
        if (fieldParts.length > 1 && fieldParts[0] === 'attr') {
            var options = columns.options[fieldParts[1]];
            if (_.indexOf(options,value) < 0) options.push(value);
        }
    });

    _.each(columns.periods,function(index,field){
        var value = +rowParts[index];
        if (value > 0) {
            var readKey = field.replace('period','read');
            var readCommand = definition[readKey];
            if (readCommand) definition.periods[value] = _.union(definition.periods[value] || [],[readCommand]);
        }
    });

    if (!definition.label) definition.label = definition.key;

    return definition;
};

CommandFactory.prototype.storeHash = function(hashKey,hash){
    var self = this;
    helpers.hash2sets(hashKey,hash,function(updates){ if (updates) self.client.send('hmset',updates).errorHint('storeHash:' + hashKey); });
};

module.exports = CommandFactory;