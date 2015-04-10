var _ = require('lodash');
var express = require('express');

var RedisCheckpoint = require('../lib/redis-checkpoint');
var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/config-helpers');
var hashkeys = require('../lib/config-hashkeys');

var redisChk = new RedisCheckpoint();
var router = express.Router();

function checkRedis(callback){
    if (redisChk.started())
        callback();
    else
        redisChk.start(function() { callback(); });
}

function requestConfig(res){
    if (!redisChk.client)
        res.send({error: 'Redis not ready'});
    else
        try {
            redisChk.client.hgetall(schema.config.key,function(err,hash){
                if (err)
                    res.send({error: 'redis error: ' + err});
                else
                    res.send({config: helpers.hash2tuples(hash || {},hashkeys)});
            });
        } catch(e) {
            res.send({error: 'config error: ' + e});
        }
}

router.get('/config',function(req,res,next){
    checkRedis(function(){
        requestConfig(res);
    });
});

router.post('/config',function(req,res,next){
    checkRedis(function(){
        // TODO 1) delete keys that match defaults?
        logger.info('config changes: ' + JSON.stringify(req.body));
        var args = [schema.config.key];
        _.each(req.body,function(value,key){
            args.push(key);
            args.push(value);
        });
        redisChk.client.hset(args,function(err,result){
            if (err)
                res.send({error: 'redis error: ' + err});
            else
                requestConfig(res);
        });
    });
});

router.get('/status',function(req,res,next){
    checkRedis(function(){
        res.send({
            redis: !!redisChk.client,
            ethernet: true, // TODO check these other services
            ppp: true,
            cpu: true,
            memory: true,
            disk: true,
            logic: true
        })
    });
});

module.exports = router;
