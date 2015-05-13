module.exports = Object.freeze({
    gateway: Object.freeze({
        imei: Object.freeze({
            label:      'IMEI',
            key:        'gateway:imei',
            type:       'string',
            default:    null,
            required:   true
        }),
        privateHost: Object.freeze({ // TODO annotate a warning that gateway changes require a restart?
            label:      'Private Host',
            key:        'gateway:private-host',
            type:       'string',
            status:     'editable',
            default:    '172.29.12.253'    // staging private IP
        }),
        privatePort: Object.freeze({
            label:      'Private Port',
            key:        'gateway:private-port',
            type:       'number',
            status:     'editable',
            default:    3011
        }),
        publicHost: Object.freeze({
            label:      'Public Host',
            key:        'gateway:public-host',
            type:       'string',
            status:     'editable',
            default:    '192.119.183.253'  // staging public IP
        }),
        publicPort: Object.freeze({
            label:      'Public Port',
            key:        'gateway:public-port',
            type:       'number',
            status:     'editable',
            default:    3011
        }),
        privateRelay: Object.freeze({
            label:      'Private Relay Port',
            key:        'gateway:private-relay',
            type:       'number',
            status:     'editable',
            default:    4000
        }),
        publicRelay: Object.freeze({
            label:      'Public Relay Port',
            key:        'gateway:public-relay',
            type:       'number',
            status:     'editable',
            default:    4001
        }),
        primary: Object.freeze({
            label:      'Primary Route',
            options:    ['public','private'],
            key:        'gateway:primary',
            type:       'string',
            status:     'editable',
            default:    'public'
        }),
        heartbeatInterval: Object.freeze({
            label:      'Heartbeat Interval',
            units:      'min',
            key:        'gateway:heartbeat-interval',
            type:       'number',
            status:     'editable',
            default:    60
        })
    }),
    PPP: Object.freeze({
        subnet: Object.freeze({
            label:      'PPP Subnet',
            key:        'ppp:subnet',
            type:       'string',
            status:     'editable',
            default:    '172.29.12.0'
        }),
        mask: Object.freeze({
            label:      'PPP Mask',
            key:        'ppp:mask',
            type:       'string',
            status:     'editable',
            default:    '255.255.255.0'
        }),
        checkInterval: Object.freeze({
            label:      'PPPD Check Interval',
            units:      'sec',
            key:        'ppp:check-interval',
            type:       'number',
            status:     'editable',
            default:    15
        })
    }),
    modem: Object.freeze({
        vendor: Object.freeze({
            label:      'vendor',
            key:        'modem:vendor',
            type:       'string',
            default:    null
        }),
        model: Object.freeze({
            label:      'model',
            key:        'modem:model',
            type:       'string',
            default:    null
        }),
        version: Object.freeze({
            label:      'version',
            key:        'modem:version',
            type:       'string',
            default:    null
        }),
        imsi: Object.freeze({
            label:      'IMSI',
            key:        'modem:imsi',
            type:       'string',
            default:    null
        }),
        serialPort: Object.freeze({
            label:      'Port File',
            key:        'modem:port-file',
            type:       'string',
            default:    null,
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
            units:      'sec',
            key:        'modem:rssi-interval',
            type:       'number',
            status:     'editable',
            default:    60
        })
    })
});
