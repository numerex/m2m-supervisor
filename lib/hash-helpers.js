var _ = require('lodash');

module.exports.hash2config = function(hash,hashkeys){
    var config = {};
    for (var field in hashkeys) {
        var keyspec = hashkeys[field];
        var value = hash[keyspec.key] || keyspec.default;
        if (keyspec.type === 'number') value = +value;
        config[field] = value;
    }
    return config;
};

module.exports.hash2groups = function(hash,groups){
    var result = {};
    _.each(groups,function(group,groupKey){
        var resultGroup = result[_.startCase(groupKey)] = [];
        _.each(group,function(keyspec){
            var result = _.defaults({key: keyspec.key},keyspec);
            var value = hash[keyspec.key];
            if (!_.isUndefined(value)) {
                if (keyspec.type === 'number') value = +value;
                result.value = value;
                result.exists = true;
            }
            resultGroup.push(result);
        })
    });
    return result;
};
