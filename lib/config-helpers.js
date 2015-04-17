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

module.exports.hash2groups = function(hash,groups){
    var result = {};
    _.each(groups,function(group,groupKey){
        var resultGroup = result[_.startCase(groupKey)] = [];
        var config = module.exports.hash2config(hash,group);
        _.each(config,function(value,key){
            var entry = group[key];
            resultGroup.push(_.defaults({key: entry.key,value: value},entry));
        })
    });
    return result;
};
