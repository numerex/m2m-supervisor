module.exports = Object.freeze({
    connection: Object.freeze({
        type: Object.freeze({
            label:      'Type',
            key:        'connection:type',
            options:    ['telnet','serial'],
            type:       'string',
            default:    'telnet',
            required:   true
        }),
        telnetAddress: Object.freeze({
            label:      'Telnet Address',
            key:        'connection:telnet:address',
            type:       'string',
            default:    null,
            required:   true
        }),
        telnetPort: Object.freeze({
            label:      'Telnet Port',
            key:        'connection:telnet:port',
            type:       'number',
            default:    10001,
            required:   true
        }),
        serialPort: Object.freeze({
            label:      'Serial Port',
            key:        'connection:serial:port',
            type:       'string',
            default:    '/dev/tty0',
            required:   true
        }),
        serialBaudRate: Object.freeze({
            label:      'Serial Baud Rate',
            key:        'connection:serial:baud-rate',
            type:       'number',
            default:    9600,
            required:   true
        })
    }),
    route: Object.freeze({
        type: Object.freeze({
            label:      'Type',
            key:        'route:type',
            options:    ['none','ad-hoc','scheduled'],
            type:       'string',
            default:    'none'
        }),
        schedule: Object.freeze({
            label:      'Schedule',
            key:        'route:schedule',
            type:       'string',
            default:    null
        })
    })
});