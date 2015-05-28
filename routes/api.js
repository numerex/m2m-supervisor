var _ = require('lodash');

var ScheduleFactory = require('../lib/schedule-factory');
var ProxyHelper = require('../lib/proxy-helper');
var RedisWatcher = require('../services/redis-watcher');
var M2mSupervisor = require('../processes/m2m-supervisor');

var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/hash-helpers');
var configTemplate = require('../lib/config-hashkeys');
var deviceTemplate = require('../lib/device-hashkeys');

var express = require('express');
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

function requestHash(res,hashKey,resultKey,template,filter){
    RedisWatcher.instance.client.hgetall(hashKey).thenHint('requestHash - ' + resultKey,function(hash){
        var result = {};
        result[resultKey] = template ? helpers.hash2groups(hash || {},template) : hash;
        filter && filter(result[resultKey]);
        res.send(result);
    });
}

function updateHash(updates,callback){
    RedisWatcher.instance.client.send('hmset',updates).thenHint('updateHash',function () {
        callback();
    });
}

function changeHash(req,res,hashKey,callback){
    helpers.hash2sets(hashKey,req.body,function(updates,deletes){
        if (!updates && !deletes)
            res.send({error: 'No changes requested'});
        else if (!deletes)
            updateHash(updates,callback);
        else
            RedisWatcher.instance.client.send('hdel',deletes).thenHint('deleteHash',function(){
                if (updates)
                    updateHash(updates,callback);
                else
                    callback();
            });
    });
}

function findIDs(keyPattern,callback){
    RedisWatcher.instance.client.keys(keyPattern).thenHint('findIDs - ' + keyPattern,callback);
}

function declareRouteList(model,schemaEntry){
    router.get('/' + model,function(req,res,next){
        requireRedis(res,function(){
            findIDs(schemaEntry.keysPattern(),function(keys){
                var result = {};
                result[model] = _.map(keys,function(key){ return schemaEntry.getParam(key); });
                res.send(result);
            })
        });
    });
}

function declareRouteGetByID(model,responder){
    router.get('/' + model + '/:id',function(req,res,next){
        requireRedis(res,function(){
            responder(res,req.params.id);
        });
    });
}

// CHECK ----------------

router.get('/check',function(req,res,next){
    res.send({});
});

// PROXY ----------------

router.get('/proxy',function(req,res,next){
    var helper = new ProxyHelper(req.query).checkConfig(function(error,config){
        req.session.proxy = config;
        if (error)
            throw(error);
        else
            res.redirectTo('/');
    });
});

router.post('/proxy',function(req,res,next){
    req.session.proxy = _.keys(req.body).length > 0 ? req.body : null;
    // TODO validate proxy
    res.redirect('/');
});

// CONFIG ----------------

router.get('/config',function(req,res,next){
    requireRedis(res,_.bind(requestConfig,this,res));
});

router.post('/config',function(req,res,next){
    requireRedis(res,function(){
        logger.info('config changes: ' + JSON.stringify(req.body));
        changeHash(req,res,schema.config.key,function(){
            // istanbul ignore if - TODO consider how to test...
            if (M2mSupervisor.instance) M2mSupervisor.instance.configWatcher.emit('checkReady');
            requestConfig(res);
        });
    });
});

function requestConfig(res){
    requestHash(res,schema.config.key,'config',configTemplate);
}

// DEVICE ----------------

declareRouteList('devices',schema.device.settings);

declareRouteGetByID('device',requestDevice);

router.post('/device/:id',function(req,res,next){
    requireRedis(res,function(){
        logger.info('device changes(' + req.params.id + '): ' + JSON.stringify(req.body));
        changeHash(req,res,schema.device.settings.useParam(req.params.id),function(){
            requestDevice(res,req.params.id);
            var deviceRouter = null;
            // istanbul ignore next - TODO consider how to test
            if (M2mSupervisor.instance && M2mSupervisor.instance.queueRouter &&
                (deviceRouter = M2mSupervisor.instance.queueRouter.routes[schema.device.queue.useParam(req.params.id)]))
                deviceRouter.settingsWatcher.emit('checkReady');
        });
    });
});

router.get('/device',function(req,res,next){
    requireRedis(res,function(){
        var profileKeys = _.select(_.collect(RedisWatcher.instance.keys,_.bind(schema.command.profile.getParam,schema.command.profile,_)));
        var scheduleKeys = _.select(_.collect(RedisWatcher.instance.keys,_.bind(schema.schedule.periods.getParam,schema.schedule.periods,_)));
        if (profileKeys.length !== 1) {
            var defaults = _.defaults(helpers.hash2groups({},deviceTemplate));
            makeOptionEditable(defaults['Connection']);
            makeOptionEditable(defaults['Commands']);
            res.send({'new-device': defaults});
        } else {
            var profileKey = profileKeys[0];
            var scheduleKey = _.indexOf(scheduleKeys,profileKey) >= 0 ? profileKey : null;
            RedisWatcher.instance.client.hgetall(schema.command.profile.useParam(profileKey)).thenHint('requestHash - ' + profileKey,function(hash){
                hash[deviceTemplate.commands.profile.key] = profileKey;
                hash[deviceTemplate.commands.schedule.key] = scheduleKey;
                var defaults = _.defaults(helpers.hash2groups(hash,deviceTemplate));

                if (scheduleKey) {
                    var routingOption = _.detect(defaults['Commands'],function(option){ return option.key === 'command:routing'});
                    routingOption.options.push('scheduled');
                    routingOption.default = 'scheduled';
                    routingOption.status = 'editable';
                }

                makeOptionEditable(defaults['Connection']);
                deleteOptionExists(defaults['Connection']);
                deleteOptionExists(defaults['Commands']); // TODO figure out how to allow profile & schedule options

                res.send({'new-device': defaults});
            });
        }
    });
});

function makeOptionEditable(options){
    _.each(options,function(option){ option.status = 'editable'; });
}

function deleteOptionExists(options){
    _.each(options,function(option){ delete option.exists; });
}

router.post('/device',function(req,res,next){
    requireRedis(res,function(){
        var id = req.body.id;
        delete req.body.id;
        if (!id)
            res.send({error: 'Device ID not provided'});
        else
            findIDs(schema.device.settings.keysPattern(),function(keys){
                id = id.replace(/[ :]/g,'-');
                var queueKey = schema.device.queue.useParam(id);
                var settingsKey = schema.device.settings.useParam(id);
                if (_.indexOf(keys,settingsKey) >= 0)
                    res.send({error: 'Device ID already used'});
                else {
                    logger.info('device creation(' + id + '): ' + JSON.stringify(req.body));
                    RedisWatcher.instance.client.incr(schema.command.nextRouteID.key).thenHint('nextRoute',function(nextID){
                        RedisWatcher.instance.client.hset(schema.command.routes.key,nextID,queueKey).thenHint('setRoute',function(){
                            changeHash(req,res,settingsKey,_.bind(requestDevice,this,res,id));                   // TODO use device factory
                            // istanbul ignore next - TODO consider how to test
                            if (M2mSupervisor.instance && M2mSupervisor.instance.routeWatcher) M2mSupervisor.instance.routeWatcher.emit('checkReady');
                        })
                    });
                }
            });
    });
});

function requestDevice(res,id){
    requestHash(res,schema.device.settings.useParam(id),'device:' + id,deviceTemplate,function(groups){
        var routingOption = _.detect(groups['Commands'],function(option){ return option.key === 'command:routing'});
        var scheduleOption = _.detect(groups['Commands'],function(option){ return option.key === 'command:schedule'});
        if (routingOption && scheduleOption && scheduleOption.value) routingOption.options.push('scheduled');
    });
}

// SCHEDULES ----------------

declareRouteList('schedules',schema.schedule.periods);

declareRouteGetByID('schedule',function(res,id){
    var factory = new ScheduleFactory(RedisWatcher.instance.client);
    factory.exportSchedules(id,function(schedules){
        var result = {};
        result['schedule:' + id] = schedules;
        res.send(result);
    });
});

// PROFILES ----------------

declareRouteList('profiles',schema.schedule.periods);

declareRouteGetByID('profile',function(res,id){
    requestHash(res,schema.command.profile.useParam(id),'profile:' + id,null);
});

declareRouteGetByID('options',function(res,id){
    requestHash(res,schema.command.options.useParam(id),'options:' + id,null);
});

declareRouteGetByID('definitions',function(res,id){
    requestHash(res,schema.command.definitions.useParam(id),'definitions:' + id,null);
});

// STATUS ----------------

router.get('/status',function(req,res,next){
    checkRedis(function(){
        var status = {};
        status.redis = !!RedisWatcher.instance.client;
        // istanbul ignore if - TODO consider how to test...
        if (M2mSupervisor.instance && !M2mSupervisor.instance.supervisorProxy){
            status.config   = M2mSupervisor.instance.configWatcher.ready();
            status.modem    = !!M2mSupervisor.instance.modemWatcher && M2mSupervisor.instance.modemWatcher.ready();
            status.ppp      = !!M2mSupervisor.instance.pppdWatcher  && M2mSupervisor.instance.pppdWatcher.ready();
            status.gateway  = !!M2mSupervisor.instance.gateway        && M2mSupervisor.instance.gateway.started();
            status.router   = !!M2mSupervisor.instance.queueRouter  && M2mSupervisor.instance.queueRouter.started();
            _.each(M2mSupervisor.instance.queueRouter && M2mSupervisor.instance.queueRouter.routes || {},function(route,key){
                status['device:' + route.deviceKey] = route.ready();
            });
        }
        res.send(status);
    });
});

module.exports = router;

module.exports.resetRedisWatcher = function(){ // NOTE instrumentation for testing
    // istanbul ignore else - testing scenario that isn't worth creating
    if (RedisWatcher.instance && RedisWatcher.instance.started()) RedisWatcher.instance.stop();
    RedisWatcher.instance = null;
};
