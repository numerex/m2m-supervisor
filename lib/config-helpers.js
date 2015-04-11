var _ = require('lodash');

module.exports.hash2config = function(hash,hashkeys){
    var config = {};
    for (var field in hashkeys) {
        var keyspec = hashkeys[field];
        var value = hash[keyspec.key] || keyspec.default;
        if (keyspec.type == 'number') value = +value;
        config[field] = value;
    }
    return config;
};

module.exports.hash2tuples = function(hash,groups){
    var tuples = [];
    _.each(groups,function(group,groupKey){
        var config = module.exports.hash2config(hash,group);
        _.each(config,function(value,key){
            var entry = group[key];
            tuples.push(_.defaults({key: entry.key,group: _.startCase(groupKey),value: value},entry));
        })
    });
    return tuples;
};
