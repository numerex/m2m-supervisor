module.exports = Object.freeze({
    EventCodes: Object.freeze({
        heartbeat:      0,      // MO
        startup:        1,      // MO
        config:         2,      // MO/MT
        status:         3,      // MO/MT

        deviceSchedule: 10,     // MO
        deviceCommand:  11,     // MO/MT
        deviceConfig:   12      // MO/MT
    }),
    ObjectTypes: Object.freeze({
        requestID:      2,      // MO: sequence number of MT command

        deviceCommand:  10,     // MO/MT: string to submit to device
        deviceResponse: 11,     // MO: string or byte array of command response
        deviceError:    12,     // MO: string of command error
        deviceIndex:    13      // MO/MT: queue index of device (defaults to 1)
    })
});