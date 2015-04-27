var _ = require('lodash');
var express = require('express');

var RedisWatcher = require('../services/redis-watcher');
var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/hash-helpers');
var configTemplate = require('../lib/config-hashkeys');
var deviceTemplate = require('../lib/device-hashkeys');

var router = express.Router();

function checkRedis(callback){
    if (!RedisWatcher.instance) new RedisWatcher();
    if (RedisWatcher.instance.started())
        callback();
    else {
        RedisWatcher.instance.start();
        _.defer(callback);
    }
}

function requireRedis(res,callback){
    checkRedis(function(){
        if (RedisWatcher.instance.ready())
            callback();
        else
            res.send({error: 'Redis not ready'});
    });
}

function requestHash(res,hashKey,resultKey,template){
    RedisWatcher.instance.client.hgetall(hashKey).thenHint('requestHash',function(hash){
        var result = {};
        result[resultKey] = helpers.hash2groups(hash || {},template);
        res.send(result);
    });
}

function updateHash(updates,callback){
    RedisWatcher.instance.client.send('hmset',updates).thenHint('updateHash',function () {
        callback();
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
        updateHash(updates,callback);
    else
        RedisWatcher.instance.client.send('hdel',deletes).thenHint('deleteHash',function(){
            if (updates.length <= 1)
                callback();
            else
                updateHash(updates,callback);
        });
}

// CONFIG ----------------

function requestConfig(res){
    requestHash(res,schema.config.key,'config',configTemplate);
}

router.get('/config',function(req,res,next){
    requireRedis(res,function(){
        requestConfig(res);
    });
});

router.post('/config',function(req,res,next){
    requireRedis(res,function(){
        logger.info('config changes: ' + JSON.stringify(req.body));
        changeHash(req,res,schema.config.key,function(){
            requestConfig(res);
        });
    });
});

// DEVICE ----------------

function findDeviceIDs(res,callback){
    RedisWatcher.instance.client.keys(schema.device.settings.keysPattern()).thenHint('findDeviceIDs',function(keys){
        callback(keys);
    });
}

router.get('/devices',function(req,res,next){
    requireRedis(res,function(){
        findDeviceIDs(res,function(keys){
            res.send({devices: _.map(keys,function(key){ return schema.device.settings.getParam(key); })});
        })
    });
});

function requestDevice(res,id){
    requestHash(res,schema.device.settings.useParam(id),'device:' + id,deviceTemplate);
}

router.get('/device/:id',function(req,res,next){
    requireRedis(res,function(){
        requestDevice(res,req.params.id);
    });
});

router.post('/device/:id',function(req,res,next){
    requireRedis(res,function(){
        logger.info('device changes(' + req.params.id + '): ' + JSON.stringify(req.body));
        changeHash(req,res,schema.device.settings.useParam(req.params.id),function(){
            requestDevice(res,req.params.id);
        });
    });
});

router.get('/device',function(req,res,next){
    requireRedis(res,function(){
        var defaults = _.defaults(helpers.hash2groups({},deviceTemplate));
        res.send({'new-device': defaults});
    });
});

router.post('/device',function(req,res,next){
    requireRedis(res,function(){
        var id = req.body.id;
        delete req.body.id;
        if (!id)
            res.send({error: 'Device ID not provided'});
        else
            findDeviceIDs(res,function(keys){
                id = id.replace(/[ :]/g,'-');
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
            redis: !!RedisWatcher.instance.client,
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

module.exports.resetRedisWatcher = function(){ // NOTE instrumentation for testing
    // istanbul ignore else - testing scenario that isn't worth creating
    if (RedisWatcher.instance && RedisWatcher.instance.started()) RedisWatcher.instance.stop();
    RedisWatcher.instance = null;
};
