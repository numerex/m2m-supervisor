module.exports = Object.freeze({
    config: Object.freeze({
        gateway: Object.freeze({
            key:    'config:gateway',
            type:   'hash'
        })
    }),
    ppp: Object.freeze({
        primary: Object.freeze({
            key:    'ppp:primary',
            type:   'string'
        }),
        hearbeatPeriod: Object.freeze({
            key:    'ppp:heartbeat-period',
            type:   'string'
        })
    }),
    ack: Object.freeze({
        message: Object.freeze({
            key:    'ack:message',
            type:   'string'
        }),
        retries: Object.freeze({
            key:    'ack:retries',
            type:   'string'
        }),
        queue: Object.freeze({
            key:    'ack:queue',
            type:   'list'
        })
    }),
    command: Object.freeze({
        queue: Object.freeze({
            key:    'command:queue',
            type:   'list'
        })
    }),
    transmit: Object.freeze({
        lastTimestamp: Object.freeze({
            key:    'transmit:last-timestamp',
            type:   'string'
        }),
        lastPrivateTimestamp: Object.freeze({
            key:    'transmit:last-private-timestamp',
            type:   'string'
        }),
        lastSequenceNumber: Object.freeze({
            key:    'transmit:last-sequence-number',
            type:   'string'
        }),
        pendingMessage: Object.freeze({
            key:    'transmit:pending-message',
            type:   'string'
        }),
        queue: Object.freeze({
            key:    'transmit:queue',
            type:   'list'
        })
    }),
    tls: Object.freeze({
        count: Object.freeze({
            key:    'tls:count',
            type:   'string'
        }),
        command: Object.freeze({
            busy: Object.freeze({
                key:    'tls-$index:command:busy-$period',
                type:   'string'
            }),
            queue: Object.freeze({
                key:    'tls-$index:command:queue',
                type:   'list'
            })
        })
    })
});