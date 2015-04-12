var express = require('express');

var logger = require('../lib/logger')('shell');
var router = express.Router();

var childprocess = null;

router.post('/',function(req,res,next) {
    logger.info('shell command: ' + JSON.stringify(req.body))
    if (!req.body || !req.body.command || req.body.command.length <= 0)
        res.send('No command given');
    else {
        if (!childprocess) childprocess = require('child_process');

        var process = childprocess.spawn(req.body.command);
        process.stdout.on('data',function(data){
            console.log('stdout:' + data);
            res.write(data);
        });
        process.stderr.on('data',function(data){
            console.log('stderr:' + data);
            res.write(data);
        });
        process.on('close',function(){
            console.log('close');
            res.end();
        })
    }
});

module.exports = router;