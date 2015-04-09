module.exports = Object.freeze({
    config: Object.freeze({
        key:    'm2m-config',
        type:   'hash'
    }),
    ack: Object.freeze({
        message: Object.freeze({
            key:    'm2m-ack:message',
            type:   'string'
        }),
        retries: Object.freeze({
            key:    'm2m-ack:retries',
            type:   'string'
        }),
        queue: Object.freeze({
            key:    'm2m-ack:queue',
            type:   'list'
        })
    }),
    command: Object.freeze({
        queue: Object.freeze({
            key:    'm2m-command:queue',
            type:   'list'
        })
    }),
    transmit: Object.freeze({
        lastTimestamp: Object.freeze({
            key:    'm2m-transmit:last-timestamp',
            type:   'string'
        }),
        lastPrivateTimestamp: Object.freeze({
            key:    'm2m-transmit:last-private-timestamp',
            type:   'string'
        }),
        lastSequenceNumber: Object.freeze({
            key:    'm2m-transmit:last-sequence-number',
            type:   'string'
        }),
        pendingMessage: Object.freeze({
            key:    'm2m-transmit:pending-message',
            type:   'string'
        }),
        queue: Object.freeze({
            key:    'm2m-transmit:queue',
            type:   'list'
        })
    })
});