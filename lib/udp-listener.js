var _ = require('lodash');
var logger = require('./logger');

function UdpListener(type,port,onmessage){
    var self = this;
    var client = self.client = require('dgram').createSocket('udp4'); // NOTE - delay require for mockery testing

    self.logger = logger(type);

    if (port) client.bind(port);

    client.on('listening', function () {
        var address = client.address();
        self.logger.info('listening on ' + address.address + ":" + address.port);
    });

    client.on('close',function () {
        self.logger.info('connection closed');
    });

    client.on('error',function (err) {
        self.logger.error('error event: ' + err);
    });

    client.on('message',function (buffer,info) {
        try {
            self.logger.info('incoming - size: ' + buffer.length + ' from: ' + info.address + ':' + info.port);
            onmessage(buffer);
        } catch(e) {
            self.logger.error('message error: ' + e);
        }
    });

}

UdpListener.prototype.send = function(buffer,host,port){
    try {
        this.logger.info('outgoing - size: ' + buffer.length + ' from: ' + host + ':' + port);
        this.client.send(buffer,0,buffer.length,port,host);
    } catch(e) {
        this.logger.error('send error: ' + e);
    }
};

module.exports = UdpListener;
