var lynx = require('lynx');
var logger = require('./logger')('lynx');

module.exports = function(prefix) {
    return lynx(null,null,{prefix: prefix,on_error: function(err) {
        logger.error('lynx error(' + prefix + '): ' + err);
    }});
};
