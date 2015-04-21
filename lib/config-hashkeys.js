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
        })
    }),
    custom: Object.freeze({
        webRoutes: Object.freeze({
            label:      'Web Routes',
            key:        'custom:web-route',
            type:       'string'
        }),
        commandModules: Object.freeze({
            label:      'Command Module',
            key:        'custom:command-module',
            type:       'string'
        }),
        extensionModule: Object.freeze({
            label:      'Extension Module',
            key:        'custom:extension-module',
            type:       'string'
        })
    })
});