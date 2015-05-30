var session = require('express-session');

var sessionOptions = {secret: 'pull-this-from-config',resave: false,saveUninitialized: false};

// istanbul ignore if -- testing will use the MemoryStore
if (!process.env.testing){
    var RedisStore = require('connect-redis')(session);
    sessionOptions.store = new RedisStore();
}

module.exports = session(sessionOptions);