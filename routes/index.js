var express = require('express');

var logger = require('../lib/logger')('api');
var router = express.Router();

router.get('/',function(req,res,next) {
    res.render('supervisor/index');
});

module.exports = router;
