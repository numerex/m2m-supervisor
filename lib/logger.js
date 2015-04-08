var bunyan = require('bunyan');
var pretty = require('./bunyan-prettyprinter');

module.exports = function(name) {
    return bunyan(pretty({name: name}));
};
