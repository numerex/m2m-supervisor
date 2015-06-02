var _ = require('lodash');
var util = require('util');

var HashWatcher = require('./hash-watcher');
var RedisWatcher = require('./redis-watcher');
var PeripheralRouter = require('./peripheral-router');

var schema = require('../lib/redis-schema');

function RouteWatcher(queueRouter,config) {
    var self = this;
    self.queueRouter = queueRouter;
    HashWatcher.apply(self,[schema.command.routes.key,config]);
    
    self.on('change',function(routes){
        if (!routes) return;

        _.each(routes,function(routeKey,routeIndex){
            var peripheralKey = schema.peripheral.queue.getParam(routeKey);

            // istanbul ignore if - should never occur, but nervous about not checking...
            if (!peripheralKey) return;

            // istanbul ignore if - should never occur, but nervous about not checking...
            if (self.queueRouter.routes[routeKey]) return;

            var peripheralRouter = new PeripheralRouter(peripheralKey);
            peripheralRouter.on('status',function(status){ if (status == 'ready') self.queueRouter.addRoute(routeIndex,peripheralRouter); });
            peripheralRouter.start(self.client);
            RedisWatcher.instance.addClientWatcher(peripheralRouter.settingsWatcher);
        });
    })
}

util.inherits(RouteWatcher,HashWatcher);

module.exports = RouteWatcher;

