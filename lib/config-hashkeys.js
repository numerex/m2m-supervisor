module.exports = Object.freeze({
    gateway: Object.freeze({
        imei: Object.freeze({
            label:      'IMEI',
            key:        'gateway:imei',
            type:       'string',
            default:    null,
            required:   true
        }),
        privateURL: Object.freeze({ // TODO annotate a warning that gateway changes require a restart?
            label:      'Private URL',
            key:        'gateway:private-url',
            type:       'string',
            status:     'editable',
            default:    'udp:172.29.12.253:3011'    // staging private IP
        }),
        publicURL: Object.freeze({
            label:      'Public URL',
            key:        'gateway:public-url',
            type:       'string',
            status:     'editable',
            default:    'https://gw-staging.services.numerex.com/pistachio'  // staging public IP
        }),
        bodyParam: Object.freeze({
            label:      'POST Body Param',
            key:        'gateway:body-param',
            type:       'string',
            status:     'editable',
            default:    'pistachio'
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
    wireless: Object.freeze({
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
        }),
        serialPort: Object.freeze({
            label:      'Modem Port File',
            key:        'modem:port-file',
            type:       'string',
            default:    null,
            required:   true
        }),
        serialBaudRate: Object.freeze({
            label:      'Modem Baud Rate',
            key:        'modem:baud-rate',
            type:       'number',
            default:    460800
        }),
        rssiInterval: Object.freeze({
            label:      'RSSI Report Interval',
            units:      'sec',
            key:        'modem:rssi-interval',
            type:       'number',
            status:     'editable',
            default:    60
        })
    }),
    system: Object.freeze({
        vendor: Object.freeze({
            label:      'Modem Vendor',
            key:        'modem:vendor',
            type:       'string',
            default:    null
        }),
        model: Object.freeze({
            label:      'Modem Model',
            key:        'modem:model',
            type:       'string',
            default:    null
        }),
        version: Object.freeze({
            label:      'Modem Version',
            key:        'modem:version',
            type:       'string',
            default:    null
        }),
        imsi: Object.freeze({
            label:      'Wireless IMSI',
            key:        'modem:imsi',
            type:       'string',
            default:    null
        })
    })
});
