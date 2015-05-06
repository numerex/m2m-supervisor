module.exports = Object.freeze({
    gateway: Object.freeze({
        imei: Object.freeze({
            label:      'IMEI',
            key:        'gateway:imei',
            type:       'string',
            default:    null,
            required:   true,
            status:     'locked'
        }),
        privateHost: Object.freeze({ // TODO annotate a warning that gateway changes require a restart?
            label:      'Private Host',
            key:        'gateway:private-host',
            type:       'string',
            default:    '172.29.12.253'    // staging private IP
        }),
        privatePort: Object.freeze({
            label:      'Private Port',
            key:        'gateway:private-port',
            type:       'number',
            default:    3011
        }),
        publicHost: Object.freeze({
            label:      'Public Host',
            key:        'gateway:public-host',
            type:       'string',
            default:    '192.119.183.253'  // staging public IP
        }),
        publicPort: Object.freeze({
            label:      'Public Port',
            key:        'gateway:public-port',
            type:       'number',
            default:    3011
        }),
        privateRelay: Object.freeze({
            label:      'Private Relay Port',
            key:        'gateway:private-relay',
            type:       'number',
            default:    4000
        }),
        publicRelay: Object.freeze({
            label:      'Public Relay Port',
            key:        'gateway:public-relay',
            type:       'number',
            default:    4001
        }),
        primary: Object.freeze({
            label:      'Primary Route',
            options:    ['public','private'],
            key:        'gateway:primary',
            type:       'string',
            default:    'public'
        }),
        heartbeatInterval: Object.freeze({
            label:      'Heartbeat Interval',
            key:        'gateway:heartbeat-interval',
            type:       'number',
            default:    60*60*1000
        })
    }),
    PPP: Object.freeze({
        interface: Object.freeze({
            label:      'PPP Interface',
            key:        'ppp:interface',
            type:       'string',
            default:    'ppp0'
        }),
        subnet: Object.freeze({
            label:      'PPP Subnet',
            key:        'ppp:subnet',
            type:       'string',
            default:    '172.29.12.0'
        }),
        mask: Object.freeze({
            label:      'PPP Mask',
            key:        'ppp:mask',
            type:       'string',
            default:    '255.255.255.0'
        }),
        routeInterval: Object.freeze({
            label:      'Route Check Interval',
            key:        'ppp:route-interval',
            type:       'number',
            default:    60*1000
        })
    }),
    modem: Object.freeze({
        serialPort: Object.freeze({
            label:      'Port File',
            key:        'modem:port-file',
            type:       'string',
            default:    '/dev/ttyUSB3',
            required:   true
        }),
        serialBaudRate: Object.freeze({
            label:      'Baud Rate',
            key:        'modem:baud-rate',
            type:       'number',
            default:    460800,
            required:   true
        }),
        rssiInterval: Object.freeze({
            label:      'RSSI Report Interval',
            key:        'modem:rssi-interval',
            type:       'number',
            default:    60*1000
        })
    })
});
