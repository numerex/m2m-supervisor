var _ = require('lodash');
var express = require('express');

var RedisCheckpoint = require('../services/redis-checkpoint');
var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/config-helpers');
var configHashkeys = require('../lib/config-hashkeys');
var deviceHashkeys = require('../lib/device-hashkeys');

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

function requestHash(res,key,hashkeys){
    if (!redisChk.ready())
        res.send({error: 'Redis not ready'});
    else
        commonRedisCall(res,function(){
            redisChk.client.hgetall(key,_.bind(commonRedisResult,this,res,_,_,function(hash){
                res.send({config: helpers.hash2tuples(hash || {},hashkeys)});
            }));
        });
}

// CONFIG ----------------

function requestConfig(res){
    requestHash(res,schema.config.key,configHashkeys);
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

// DEVICE ----------------

router.get('/devices',function(req,res,next){
    checkRedis(function(){
        commonRedisCall(res,function(){
            redisChk.client.keys(schema.device.settings.keysPattern(),_.bind(commonRedisResult,this,res,_,_,function(keys){
                res.send(_.map(keys,function(key){ return schema.device.settings.getParam(key); }));
            }));
        });
    });
});

function requestDevice(res,id){
    requestHash(res,schema.device.settings.useParam(req.params.id),deviceHashkeys);
}

router.get('/device/:id',function(req,res,next){
    checkRedis(function(){
        requestDevice(res,req.params.id);
    });
});

// STATUS ----------------

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
