var session = require('express-session');

var MemoryStore = require('express-session/session/memory');

var sessionOptions = {secret: 'pull-this-from-config',resave: false,saveUninitialized: false};

// istanbul ignore else -- testing will use the MemoryStore
if (process.env.testing)
    sessionOptions.store = new MemoryStore();
else {
    var RedisStore = require('connect-redis')(session);
    sessionOptions.store = new RedisStore();
}

module.exports = session(sessionOptions);

module.exports.sessionOptions = sessionOptions;