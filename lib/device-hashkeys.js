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
            default:    'localhost',
            required:   true
        }),
        telnetPort: Object.freeze({
            label:      'Telnet Address',
            key:        'connection:telnet:port',
            type:       'string',
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
            type:       'string',
            default:    9600,
            required:   true
        })
    }),
    schedule: Object.freeze({
        _param: Object.freeze({
            label:      'Period',
            key:        '$period',
            type:       'number'
        }),
        commands: Object.freeze({
            label:      'Commands',
            key:        'schedule:$period',
            param:      '$period',
            type:       'string'
        })
    })
});