module.exports = Object.freeze({
    EventCodes: Object.freeze({
        heartbeat:  0x00,
        startup:    0x01,

        status:     0x10,
        scheduled:  0x11,
        requested:  0x12
    }),
    ObjectTypes: Object.freeze({
        deviceCommand:  10,
        deviceResponse: 11,
        deviceError:    12
    })
});