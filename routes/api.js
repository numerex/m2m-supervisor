var _ = require('lodash');
var express = require('express');

var RedisCheckpoint = require('../services/redis-checkpoint');
var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/hash-helpers');
var configTemplate = require('../lib/config-hashkeys');
var deviceTemplate = require('../lib/device-hashkeys');

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

function requestHash(res,hashKey,resultKey,template){
    if (!redisChk.ready())
        res.send({error: 'Redis not ready'});
    else
        commonRedisCall(res,function(){
            redisChk.client.hgetall(hashKey,_.bind(commonRedisResult,this,res,_,_,function(hash){
                var result = {};
                result[resultKey] = helpers.hash2groups(hash || {},template);
                res.send(result);
            }));
        });
}

function updateHash(res,updates,callback){
    commonRedisCall(res,function() {
        redisChk.client.hmset(updates, _.bind(commonRedisResult, this, res, _, _, function () {
            callback();
        }));
    });
}

function changeHash(req,res,hashKey,callback){
    var deletes = [hashKey];
    var updates = [hashKey];
    _.each(req.body,function(value,key){
        if (value === null)
            deletes.push(key);
        else {
            updates.push(key);
            updates.push(value);
        }
    });
    if (updates.length <= 1 && deletes.length <= 1)
        res.send({error: 'No changes requested'});
    else if (deletes.length <= 1)
        updateHash(res,updates,callback);
    else
        commonRedisCall(res,function(){
            redisChk.client.hdel(deletes,_.bind(commonRedisResult,this,res,_,_,function(){
                if (updates.length <= 1)
                    callback();
                else
                    updateHash(res,updates,callback);
            }));
        });
}

// CONFIG ----------------

function requestConfig(res){
    requestHash(res,schema.config.key,'config',configTemplate);
}

router.get('/config',function(req,res,next){
    checkRedis(function(){
        requestConfig(res);
    });
});

router.post('/config',function(req,res,next){
    checkRedis(function(){
        logger.info('config changes: ' + JSON.stringify(req.body));
        changeHash(req,res,schema.config.key,function(){
            requestConfig(res);
        });
    });
});

// DEVICE ----------------

function findDeviceIDs(res,callback){
    commonRedisCall(res,function(){
        redisChk.client.keys(schema.device.settings.keysPattern(),_.bind(commonRedisResult,this,res,_,_,function(keys){
            callback(keys);
        }));
    });
}

router.get('/devices',function(req,res,next){
    checkRedis(function(){
        findDeviceIDs(res,function(keys){
            res.send(_.map(keys,function(key){ return schema.device.settings.getParam(key); }));
        })
    });
});

function requestDevice(res,id){
    requestHash(res,schema.device.settings.useParam(id),'device:' + (id || 'new'),deviceTemplate);
}

router.get('/device',function(req,res,next){
    var defaults = _.defaults(helpers.hash2groups({},deviceTemplate));
    res.send({'new-device': defaults});
});

router.get('/device/:id',function(req,res,next){
    checkRedis(function(){
        requestDevice(res,req.params.id);
    });
});

router.post('/device/:id',function(req,res,next){
    checkRedis(function(){
        logger.info('device changes(' + req.params.id + '): ' + JSON.stringify(req.body));
        changeHash(req,res,schema.device.settings.useParam(req.params.id),function(){
            requestDevice(res,req.params.id);
        });
    });
});

router.post('/device',function(req,res,next){
    checkRedis(function(){
        var id = req.body.id;
        delete req.body.id;
        if (!id)
            res.send({error: 'Device ID not provided'});
        else
            findDeviceIDs(res,function(keys){
                var newKey = schema.device.settings.useParam(id);
                if (_.indexOf(keys,newKey) >= 0)
                    res.send({error: 'Device ID already used'});
                else {
                    logger.info('device creation(' + id + '): ' + JSON.stringify(req.body));
                    changeHash(req,res,newKey,function(){
                        requestDevice(res,id);
                    });
                }
            });
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
