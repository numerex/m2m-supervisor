var _ = require('lodash');

function SchemaEntry(attributes){
    _.defaults(this,attributes,{
        type: 'string'
    });
}

SchemaEntry.prototype.keysPattern = function(){
    return this.param && this.key.replace(this.param,'*');
};

SchemaEntry.prototype.getParam = function(actual){
    var regexp = new RegExp(this.key.replace(this.param,'([^:]+)'));
    var match = regexp.exec(actual);
    return match && match[1];
};

SchemaEntry.prototype.useParam = function(actual){
    return this.key.replace(this.param,actual);
};

module.exports = Object.freeze({
    config: new SchemaEntry({
        key:    'm2m-config',
        type:   'hash'
    }),
    proxyPeer: new SchemaEntry({
        key:    'm2m-proxy-peer',
        type:   'string'
    }),
    ack: Object.freeze({
        message: new SchemaEntry({
            key:    'm2m-ack:message'
        }),
        routeKey: new SchemaEntry({
            key:    'm2m-ack:route-key'
        }),
        retries: new SchemaEntry({
            key:    'm2m-ack:retries'
        }),
        ticks: new SchemaEntry({
            key:    'm2m-ack:ticks'
        }),
        sequenceNumber: new SchemaEntry({
            key:    'm2m-ack:sequence-number'
        }),
        queue: new SchemaEntry({
            key:    'm2m-ack:queue',
            type:   'list'
        })
    }),
    command: Object.freeze({
        profile: new SchemaEntry({
            key:    'm2m-command:$id:profile',
            type:   'hash',
            param:  '$id'
        }),
        options: new SchemaEntry({
            key:    'm2m-command:$id:options',
            type:   'hash',
            param:  '$id'
        }),
        definitions: new SchemaEntry({
            key:    'm2m-command:$id:definitions',
            type:   'hash',
            param:  '$id'
        }),
        routes: new SchemaEntry({
            key:    'm2m-command:routes',
            type:   'hash'
        }),
        nextRouteID: new SchemaEntry({
            key:    'm2m-command:next-route',
            type:   'number'
        }),
        queue: new SchemaEntry({
            key:    'm2m-command:queue',
            type:   'list'
        })
    }),
    peripheral: Object.freeze({
        settings: new SchemaEntry({
            key:    'm2m-peripheral:$id:settings',
            param:  '$id',
            type:   'hash'
        }),
        queue: new SchemaEntry({
            key:    'm2m-peripheral:$id:queue',
            param:  '$id',
            type:   'list'
        })
    }),
    schedule: Object.freeze({
        periods: new SchemaEntry({
            key:    'm2m-schedule:$id:periods',
            param:  '$id',
            type:   'hash'
        })
    }),
    transmit: Object.freeze({
        lastTimestamp: new SchemaEntry({
            key:    'm2m-transmit:last-timestamp'
        }),
        lastPrivateTimestamp: new SchemaEntry({
            key:    'm2m-transmit:last-private-timestamp'
        }),
        lastSequenceNumber: new SchemaEntry({
            key:    'm2m-transmit:last-sequence-number'
        }),
        queue: new SchemaEntry({
            key:    'm2m-transmit:queue',
            type:   'list'
        })
    }),
    web: Object.freeze({
        queue: new SchemaEntry({
            key:    'm2m-web:$id:queue',
            param:  '$id',
            type:   'list'
        })
    })
});