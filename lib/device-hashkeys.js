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
    commands: Object.freeze({
        profile: Object.freeze({
            label:      'Profile',
            key:        'command:profile',
            type:       'string',
            default:    null
        }),
        routing: Object.freeze({
            label:      'Routing',
            key:        'command:routing',
            options:    ['ad-hoc','scheduled','none'],
            type:       'string',
            default:    'ad-hoc'
        }),
        schedule: Object.freeze({
            label:      'Schedule',
            key:        'command:schedule',
            type:       'string',
            default:    null
        }),
        commandPrefix: Object.freeze({
            label:      'Command Prefix',
            key:        'command:command-prefix',
            type:       'string',
            default:    null
        }),
        commandSuffix: Object.freeze({
            label:      'Command Suffix',
            key:        'command:command-suffix',
            type:       'string',
            default:    null
        }),
        responsePrefix: Object.freeze({
            label:      'Response Prefix',
            key:        'command:response-prefix',
            type:       'string',
            default:    null
        }),
        responseSuffix: Object.freeze({
            label:      'Response Suffix',
            key:        'command:response-suffix',
            type:       'string',
            default:    null
        })
    })
});