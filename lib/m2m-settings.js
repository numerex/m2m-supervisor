module.exports = Object.freeze({
    EventCodes: Object.freeze({
        heartbeat:      0,      // MO
        startup:        1,      // MO
        config:         2,      // MO/MT
        status:         3,      // MO/MT
        restart:        4,      // MT -- should result in "startup"
        reboot:         5,      // MT -- should result in "startup"

        peripheralSchedule: 10,     // MO/MT
        peripheralCommand:  11,     // MO/MT
        peripheralConfig:   12      // MO/MT
    }),
    ObjectTypes: Object.freeze({
        requestID:      2,      // MO: sequence number of MT command

        peripheralCommand:  10,     // MO/MT: string to submit to peripheral
        peripheralResponse: 11,     // MO: string or byte array of command response
        peripheralError:    12,     // MO: string of command error
        peripheralIndex:    13      // MO/MT: queue index of peripheral (defaults to 1)
    })
});