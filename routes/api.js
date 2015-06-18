var _ = require('lodash');

var ScheduleFactory = require('../lib/schedule-factory');
var ProxyHelper = require('../lib/proxy-helper');
var RedisWatcher = require('../services/redis-watcher');
var M2mSupervisor = require('../processes/m2m-supervisor');

var logger = require('../lib/logger')('api');
var schema = require('../lib/redis-schema');
var helpers = require('../lib/hash-helpers');
var configTemplate = require('../lib/config-hashkeys');
var peripheralTemplate = require('../lib/peripheral-hashkeys');

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

function declareRouteList(model,allowProxy,schemaEntry){
    router.get('/' + model,function(req,res,next){
        if (allowProxy && req.session.proxy) return proxiedGET(req.session.proxy,'/' + model,res);

        requireRedis(res,function(){
            findIDs(schemaEntry.keysPattern(),function(keys){
                var result = {};
                result[model] = _.map(keys,function(key){ return schemaEntry.getParam(key); });
                res.send(result);
            })
        });
    });
}

function declareRouteGetByID(model,allowProxy,responder){
    router.get('/' + model + '/:id',function(req,res,next){
        if (allowProxy && req.session.proxy) return proxiedGET(req.session.proxy,'/' + model + '/' + req.params.id,res);

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
    setProxy(req,res,req.query);
});

router.post('/proxy',function(req,res,next){
    setProxy(req,res,req.body);
});

function setProxy(req,res,config){
    requireRedis(res,function() {
        var uri = config && config.uri;
        if (uri) delete config.uri;

        new ProxyHelper(RedisWatcher.instance.client,config).checkConfig(function (error, proxy) {
            req.session.proxy = proxy;
            if (error)
                logger.error('proxy error: ' + error.message);
            else
                logger.info('set proxy: ' + JSON.stringify(proxy));
            res.redirect(uri ? uri : '/');
        });
    });
}

function proxiedGET(proxy,path,res){
    requireRedis(res,function(){
        new ProxyHelper(RedisWatcher.instance.client,proxy).get(path,res);
    });
}

function proxiedPOST(proxy,path,body,res){
    requireRedis(res,function(){
        new ProxyHelper(RedisWatcher.instance.client,proxy).post(path,body,res);
    });
}

// CONFIG ----------------

router.get('/config',function(req,res,next){
    if (req.session.proxy) return proxiedGET(req.session.proxy,'/config',res);

    requireRedis(res,_.bind(requestConfig,this,res));
});

router.post('/config',function(req,res,next){
    if (req.session.proxy) return proxiedPOST(req.session.proxy,'/config',req.body,res);

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

// PERIPHERAL ----------------

declareRouteList('peripherals',true,schema.peripheral.settings);

declareRouteGetByID('peripheral',true,requestPeripheral);

router.post('/peripheral/:id',function(req,res,next){
    if (req.session.proxy) return proxiedPOST(req.session.proxy,'/peripheral/' + req.params.id,req.body,res);

    requireRedis(res,function(){
        logger.info('peripheral changes(' + req.params.id + '): ' + JSON.stringify(req.body));
        changeHash(req,res,schema.peripheral.settings.useParam(req.params.id),function(){
            requestPeripheral(res,req.params.id);
            var peripheralRouter = null;
            // istanbul ignore next - TODO consider how to test
            if (M2mSupervisor.instance && M2mSupervisor.instance.queueRouter &&
                (peripheralRouter = M2mSupervisor.instance.queueRouter.routes[schema.peripheral.queue.useParam(req.params.id)]))
                peripheralRouter.settingsWatcher.emit('checkReady');
        });
    });
});

router.get('/peripheral',function(req,res,next){
    if (req.session.proxy) return proxiedGET(req.session.proxy,'/peripheral',res);

    requireRedis(res,function(){
        var profileKeys = _.select(_.collect(RedisWatcher.instance.keys,_.bind(schema.command.profile.getParam,schema.command.profile,_)));
        var scheduleKeys = _.select(_.collect(RedisWatcher.instance.keys,_.bind(schema.schedule.periods.getParam,schema.schedule.periods,_)));
        if (profileKeys.length !== 1) {
            var defaults = _.defaults(helpers.hash2groups({},peripheralTemplate));
            makeOptionEditable(defaults['Connection']);
            makeOptionEditable(defaults['Commands']);
            res.send({'new-peripheral': defaults});
        } else {
            var profileKey = profileKeys[0];
            var scheduleKey = _.indexOf(scheduleKeys,profileKey) >= 0 ? profileKey : null;
            RedisWatcher.instance.client.hgetall(schema.command.profile.useParam(profileKey)).thenHint('requestHash - ' + profileKey,function(hash){
                hash[peripheralTemplate.commands.profile.key] = profileKey;
                hash[peripheralTemplate.commands.schedule.key] = scheduleKey;
                var defaults = _.defaults(helpers.hash2groups(hash,peripheralTemplate));

                if (scheduleKey) {
                    var routingOption = _.detect(defaults['Commands'],function(option){ return option.key === 'command:routing'});
                    routingOption.options.push('scheduled');
                    routingOption.default = 'scheduled';
                    routingOption.status = 'editable';
                }

                makeOptionEditable(defaults['Connection']);
                deleteOptionExists(defaults['Connection']);
                deleteOptionExists(defaults['Commands']); // TODO figure out how to allow profile & schedule options

                res.send({'new-peripheral': defaults});
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

router.post('/peripheral',function(req,res,next){
    if (req.session.proxy) return proxiedPOST(req.session.proxy,'/peripheral',req.body,res);

    requireRedis(res,function(){
        var id = req.body.id;
        delete req.body.id;
        if (!id)
            res.send({error: 'Peripheral ID not provided'});
        else
            findIDs(schema.peripheral.settings.keysPattern(),function(keys){
                id = id.replace(/[ :]/g,'-');
                var queueKey = schema.peripheral.queue.useParam(id);
                var settingsKey = schema.peripheral.settings.useParam(id);
                if (_.indexOf(keys,settingsKey) >= 0)
                    res.send({error: 'Peripheral ID already used'});
                else {
                    logger.info('peripheral creation(' + id + '): ' + JSON.stringify(req.body));
                    RedisWatcher.instance.client.incr(schema.command.nextRouteID.key).thenHint('nextRoute',function(nextID){
                        RedisWatcher.instance.client.hset(schema.command.routes.key,nextID,queueKey).thenHint('setRoute',function(){
                            changeHash(req,res,settingsKey,_.bind(requestPeripheral,this,res,id));                   // TODO use peripheral factory
                            // istanbul ignore next - TODO consider how to test
                            if (M2mSupervisor.instance && M2mSupervisor.instance.routeWatcher) M2mSupervisor.instance.routeWatcher.emit('checkReady');
                        })
                    });
                }
            });
    });
});

function requestPeripheral(res,id){
    requestHash(res,schema.peripheral.settings.useParam(id),'peripheral:' + id,peripheralTemplate,function(groups){
        var routingOption = _.detect(groups['Commands'],function(option){ return option.key === 'command:routing'});
        var scheduleOption = _.detect(groups['Commands'],function(option){ return option.key === 'command:schedule'});
        if (routingOption && scheduleOption && scheduleOption.value) routingOption.options.push('scheduled');
    });
}

// SCHEDULES ----------------

declareRouteList('schedules',false,schema.schedule.periods);

declareRouteGetByID('schedule',false,function(res,id){
    var factory = new ScheduleFactory(RedisWatcher.instance.client);
    factory.exportSchedules(id,function(schedules){
        var result = {};
        result['schedule:' + id] = schedules;
        res.send(result);
    });
});

// PROFILES ----------------

declareRouteList('profiles',false,schema.schedule.periods);

declareRouteGetByID('profile',false,function(res,id){
    requestHash(res,schema.command.profile.useParam(id),'profile:' + id,null);
});

declareRouteGetByID('options',false,function(res,id){
    requestHash(res,schema.command.options.useParam(id),'options:' + id,null);
});

declareRouteGetByID('definitions',false,function(res,id){
    requestHash(res,schema.command.definitions.useParam(id),'definitions:' + id,null);
});

// STATUS ----------------

router.get('/status',function(req,res,next){
    if (req.session.proxy) return proxiedGET(req.session.proxy,'/status',res);

    checkRedis(function(){
        var status = {};
        status.redis = !!RedisWatcher.instance.client;
        // istanbul ignore next - TODO consider how to test...
        if (M2mSupervisor.instance && !M2mSupervisor.instance.supervisorProxy){
            status.config   = M2mSupervisor.instance.configWatcher.ready();
            status.ethernet = !!M2mSupervisor.instance.dhclient     && M2mSupervisor.instance.dhclient.ready();
            status.ppp      = !!M2mSupervisor.instance.pppd         && M2mSupervisor.instance.pppd.ready();
            status.modem    = !!M2mSupervisor.instance.modem        && M2mSupervisor.instance.modem.ready();
            status.gateway  = !!M2mSupervisor.instance.gateway      && M2mSupervisor.instance.gateway.started();
            status.router   = !!M2mSupervisor.instance.queueRouter  && M2mSupervisor.instance.queueRouter.started();
            _.each(M2mSupervisor.instance.queueRouter && M2mSupervisor.instance.queueRouter.routes || {},function(route,key){
                status['peripheral:' + route.peripheralKey] = route.ready();
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
