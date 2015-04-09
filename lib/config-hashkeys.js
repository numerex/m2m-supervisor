module.exports = Object.freeze({
    gateway: Object.freeze({
        imei: Object.freeze({
            key:        'gateway:imei',
            type:       'string',
            default:    null
        }),
        privateHost: Object.freeze({
            key:        'gateway:private-host',
            type:       'string',
            default:    '172.29.12.253'    // staging private IP
        }),
        privatePort: Object.freeze({
            key:        'gateway:private-port',
            type:       'number',
            default:    3011
        }),
        publicHost: Object.freeze({
            key:        'gateway:public-host',
            type:       'string',
            default:    '192.119.183.253'  // staging public IP
        }),
        publicPort: Object.freeze({
            key:        'gateway:public-port',
            type:       'number',
            default:    3011
        }),
        privateRelay: Object.freeze({
            key:        'gateway:private-relay',
            type:       'number',
            default:    4000
        }),
        publicRelay: Object.freeze({
            key:        'gateway:public-relay',
            type:       'number',
            default:    4001
        }),
        primary: Object.freeze({
            key:        'gateway:primary',
            type:       'string',
            default:    'public'
        })
    })
});