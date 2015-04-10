var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var statsd = require('express-statsd');
var logger = require('express-bunyan-logger');

var pretty = require('./lib/bunyan-prettyprinter');

var index = require('./routes/index');
var api = require('./routes/api');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'),{layout:false});
app.set('view engine', 'jade');

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(statsd({prefix: 'www'}));
app.use(logger(pretty({name: 'express',immediate: true})));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'node_modules/angular')));
app.use(express.static(path.join(__dirname, 'node_modules/angular-ui-router/release')));
app.use(express.static(path.join(__dirname, 'node_modules/d3')));
app.use(express.static(path.join(__dirname, 'node_modules/jquery/dist')));

app.use('/', index);

app.use('/api', api);

app.use('/partials',function (req,res) {
    res.render('partials' + req.path);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
