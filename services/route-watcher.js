var _ = require('lodash');
var util = require('util');

var HashWatcher = require('./hash-watcher');
var RedisWatcher = require('./redis-watcher');
var DeviceRouter = require('./device-router');

var schema = require('../lib/redis-schema');

function RouteWatcher(queueRouter,config) {
    var self = this;
    self.queueRouter = queueRouter;
    HashWatcher.apply(self,[schema.command.routes.key,config]);
    
    self.on('change',function(routes){
        if (!routes) return;

        _.each(routes,function(routeKey,routeID){
            var deviceKey = schema.device.queue.getParam(routeKey);
            // istanbul ignore if - should never occur, but nervous about not checking...
            if (!deviceKey) return;
            // istanbul ignore if - TODO maybe recreate or refresh it??
            if (self.queueRouter.routes[routeKey]) return;

            var deviceRouter = new DeviceRouter(deviceKey)
                .on('status',function(status){ if (status == 'ready') self.queueRouter.addRoute(routeID,deviceRouter); });
            deviceRouter.start(self.client);
            RedisWatcher.instance.addClientWatcher(deviceRouter.settingsWatcher);
        });
    })
}

util.inherits(RouteWatcher,HashWatcher);

module.exports = RouteWatcher;

