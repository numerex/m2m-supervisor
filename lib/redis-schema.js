var _ = require('lodash');

function SchemaEntry(attributes){
    _.defaults(this,attributes,{
        type: 'string'
    });
}

SchemaEntry.prototype.keysPattern = function(){
    return this.param ? this.key.replace(this.param,'*') : this.key;
};

SchemaEntry.prototype.getParam = function(actual){
    if (!this.regexp) this.regexp = new RegExp(this.key.replace(this.param,'([^:]+)'));
    var match = this.regexp.exec(actual);
    return match && match[1];
};

module.exports = Object.freeze({
    config: new SchemaEntry({
        key:    'm2m-config',
        type:   'hash'
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
        sequenceNumber: new SchemaEntry({
            key:    'm2m-ack:sequence-number'
        }),
        queue: new SchemaEntry({
            key:    'm2m-ack:queue',
            type:   'list'
        })
    }),
    command: Object.freeze({
        queue: new SchemaEntry({
            key:    'm2m-command:queue',
            type:   'list'
        })
    }),
    device: Object.freeze({
        settings: new SchemaEntry({
            key:    'm2m-device:$id:settings',
            param:  '$id',
            type:   'hash'
        }),
        queue: new SchemaEntry({
            key:    'm2m-device:$id:queue',
            param:  '$id',
            type:   'list'
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
    })
});