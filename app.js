var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var statsd = require('express-statsd');
var logger = require('express-bunyan-logger');

var sessionOptions = {secret: 'pull-this-from-config',resave: false,saveUninitialized: false};
// istanbul ignore if -- testing will use the MemoryStore
if (!process.env.testing){
    var RedisStore = require('connect-redis')(session);
    sessionOptions.store = new RedisStore();
}

var pretty = require('./lib/bunyan-prettyprinter');

var index = require('./routes/index');
var api = require('./routes/api');

var app = express();

app.set('views', path.join(__dirname, 'views'),{layout:false});
app.set('view engine', 'jade');

app.use(favicon(__dirname + '/public/supervisor/favicon.ico'));
app.use(statsd({prefix: 'www'}));
app.use(logger(pretty({name: 'express',immediate: true})));
app.use(session(sessionOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// TODO remove in favor of CDN?
//app.use(express.static(path.join(__dirname, 'node_modules/angular')));
//app.use(express.static(path.join(__dirname, 'node_modules/angular-filter/dist')));
//app.use(express.static(path.join(__dirname, 'node_modules/angular-ui-router/release')));
//app.use(express.static(path.join(__dirname, 'node_modules/d3')));
//app.use(express.static(path.join(__dirname, 'node_modules/jquery/dist')));

app.use('/',index);
app.use('/supervisor',index);
app.use('/api/supervisor',api);

app.use('/supervisor/partials',function (req,res) {
    res.render('supervisor/partials' + req.path);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found: ' + req.originalUrl);
    err.status = 404;
    next(err);
});

// error handlers

app.use(function(err, req, res, next) {
    // istanbul ignore next -- TODO how to generate a 500 error??
    res.status(err.status || 500);
    // istanbul ignore next -- testing doesn't need to create environments
    res.render('supervisor/error', {
        message: err.message,
        error: app.get('env') === 'development' ? err : {}
    });
});

module.exports = app;
