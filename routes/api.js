var _ = require('lodash');
var express = require('express');

var RedisCheckpoint = require('../services/redis-checkpoint');
var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/config-helpers');
var hashkeys = require('../lib/config-hashkeys');

var redisChk = new RedisCheckpoint();
var router = express.Router();

function checkRedis(callback){
    if (!redisChk) redisChk = new RedisCheckpoint();
    if (!redisChk.started()) redisChk.start();
    callback();
}

function commonRedisCall(res,callback){
    try {
        callback();
    } catch(e) {
        // istanbul ignore next - not sure how to generate this error in mocking
        logger.error('redis exception: ' + e);
        // istanbul ignore next - not sure how to generate this error in mocking
        res.send({error: 'redis exception: ' + e});
    }
}

function commonRedisResult(res,err,result,callback){
    if (!err)
        callback(result);
    else {
        logger.error('redis error: ' + err);
        res.send({error: 'redis error: ' + err});
    }
}

function requestConfig(res){
    if (!redisChk.ready())
        res.send({error: 'Redis not ready'});
    else
        commonRedisCall(res,function(){
            redisChk.client.hgetall(schema.config.key,_.bind(commonRedisResult,this,res,_,_,function(hash){
                res.send({config: helpers.hash2tuples(hash || {},hashkeys)});
            }));
        });
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
        if (args.length <= 1)
            res.send({error: 'No changes requested'});
        else
            commonRedisCall(res,function(){
                redisChk.client.hmset(args,_.bind(commonRedisResult,this,res,_,_,function(){
                    requestConfig(res);
                }));
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

module.exports.resetRedisChk = function(){ // NOTE instrumentation for testing
    // istanbul ignore else - testing scenario that isn't worth creating
    if (redisChk && redisChk.started()) redisChk.stop();
    redisChk = null;
};
