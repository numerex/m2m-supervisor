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

CommandFactory.prototype.loadCommandsTSV = function(){
    var filename = arguments[0];
    var catalogID = arguments[1];
    var callback = arguments[2];

    if (typeof arguments[1] === 'function') {
        catalogID = null;
        callback = arguments[1];
    }

    if (!catalogID) catalogID = path.basename(filename,path.extname(filename));

    logger.info('load file: ' + filename);

    try{
        var data = fs.readFileSync(filename);
        var rows = data.toString().split('\n');
        this.loadCommandRows(catalogID,rows,callback);
    } catch(e){
        logger.error('load file error: ' + e.message);
        callback && callback(null);
    }
};

CommandFactory.prototype.loadCommandRows = function(catalogID,rows,callback){
    var self = this;
    try {
        logger.info('load commands: ' + catalogID);

        if (rows.length <= 1) throw(new Error('no rows defined'));

        var columns = self.parseHeader(rows.shift());
        var labels = {};
        var periods = {};
        var definitions = {};

        _.each(rows,function(row,index){
            var definition = self.parseDefinition(row,columns);

            if (!definition.key) throw(new Error('missing key (row ' + (index + 2) + ')'));

            if (definitions[definition.key]) throw(new Error('duplicate command key: ' + definition.key + ' (row ' + (index + 2) + ')'));
            definitions[definition.key] = definition;

            if (labels[definition.label]) throw(new Error('duplicate command label: ' + definition.label + ' (row ' + (index + 2) + ')'));
            labels[definition.label] = definition.key;

            _.each(definition.periods,function(commands,period){
                periods[period] = _.union(periods[period] || [],commands);
            });
        });

        var columnsKey = schema.command.columns.useParam(catalogID);
        var definitionsKey = schema.command.definitions.useParam(catalogID);

        self.client.del(columnsKey).errorHint('delColumns');
        self.client.del(definitionsKey).thenHint('delDefinitions',function(){
            self.storeHash(columnsKey,columns);
            self.storeHash(definitionsKey,definitions);

            var schedules = _.map(periods,function(commands,period) { return {period: period,commands: commands}; });
            new ScheduleFactory(self.client).loadSchedules(catalogID,schedules,callback);
        });

    } catch(e){
        logger.error(catalogID + ' - ' + e.message);
        callback && callback(null)
    }
};

CommandFactory.prototype.parseHeader = function(header){
    var columns = {indices: {},types: {read: {},write: {},attr: {}},options: {},periods: {}};

    _.each(header.split('\t'),function(value,index){
        if (_.indexOf(['types','periods'],value) >= 0) throw(new Error('invalid column name: ' + value));

        if (!_.isUndefined(columns.indices[value])) throw(new Error('duplicate column name: ' + value));
        columns.indices[value] = index;

        if (_.startsWith(value,'period')) columns.periods[value] = index;

        var parts = value.split(':');
        if (parts.length > 2) throw(new Error('too many column name parts: ' + value));

        if (parts.length > 1)
            switch(parts[0]){
                case 'read':
                case 'write':
                    columns.types[parts[0]][parts[1]] = index;
                    break;
                case 'attr':
                    columns.types[parts[0]][parts[1]] = index;
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