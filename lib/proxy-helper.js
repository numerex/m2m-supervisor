var _ = require('lodash');
var url = require('url');
var util = require('util');
var events = require('events');

var schema = require('./redis-schema');

function ProxyHelper(client,config){
    var self = this;
    self.client = client;
    self.config = config;
    self.http  = require('http'); // NOTE delayed for testing

    self.on('checkProxyPeer',_.bind(self._checkProxyPeer,self));
    self.on('checkHost',_.bind(self._checkHost,self));
    self.on('checkResult',function(error){
        self.checkCallback && self.checkCallback(error,error || !self.config.hostname ? null : {hostname: self.config.hostname});
        self.checkCallback = null;
    });
}

util.inherits(ProxyHelper,events.EventEmitter);

ProxyHelper.prototype.get = function(path,res){
    this.request('GET',path,null,res);
};

ProxyHelper.prototype.post = function(path,body,res){
    this.request('POST',path,body,res);
};

ProxyHelper.prototype.request = function(method,path,body,res){
    var self = this;
console.log('proxy:' + self.config.hostname);
    var req = self.http.request({method: method,hostname: self.config.hostname,port: 5000,path: '/supervisor/api' + path},function(proxyRes){  // TODO make port configurable??
console.dir([proxyRes.statusCode,proxyRes.statusMessage]);
        if (proxyRes.statusCode !== 200) return res.send({error: 'Error: ' + proxyRes.statusCode + ' ' + proxyRes.statusMessage});

        var contentLength = +proxyRes.headers['content-length'];
        var bufferLength = 0;
        self.buffer = null;
        proxyRes.on('data',function(data){
console.log('data:' + data);
            try{
                if (data.length === contentLength) return res.send(data);

                if (!self.buffer) self.buffer = new Buffer(contentLength);
                data.copy(self.buffer,bufferLength,0,data.length);
                bufferLength += data.length;
                if (bufferLength === contentLength) {
                    res.send(self.buffer);
                    self.buffer = null;
                }
            }catch(e){
                var pr = proxyRes;
                console.dir(pr);
                logger.error('proxy error: ' + e.message);
            }
        });
    });
    req.on('error',function(error){
console.log('error:' + error);
        res.send({error: error});
    });
console.log('body:' + body);
    if (body)
        res.send(body);
    else
        res.end();
};

//body:{"gateway:private-url":null,"gateway:public-url":null,"gateway:body-param":null,"gateway:private-relay":null,"gateway:public-relay":null,"gateway:primary":"public","gateway:heartbeat-interval":null,"ppp:subnet":null,"ppp:mask":null,"ppp:check-interval":null,"modem:baud-rate":null,"modem:rssi-interval":20}


ProxyHelper.prototype.checkConfig = function(callback) {
    this.checkCallback = callback;
    this.emit('checkProxyPeer');
};

ProxyHelper.prototype._checkProxyPeer = function(){
    var self = this;
    self.client.get(schema.proxyPeer.key).thenHint('proxyPeer',function(proxyPeer){
        if (!proxyPeer) return self.emit('checkHost');
        
        var https = require('https'); // NOTE delayed for testing
        
        var urlParts = url.parse(proxyPeer);
        var req = https.request(_.defaults({method: 'POST'},_.pick(urlParts,'hostname','port','path')),function(res){
            self.emit('checkHost');
        });
        req.on('error',function(error){
            self.emit('checkResult',error);
        });
        req.write('session=' + config.session);
        req.end();
    });
};

ProxyHelper.prototype._checkHost = function(){
    var self = this;
    var req = self.http.request({method: 'GET',hostname: self.config.hostname,port: 5000,path: '/supervisor/api/check'},function(res){  // TODO make port configurable??
        self.emit('checkResult',null);
    });
    req.on('error',function(error){
        self.emit('checkResult',error);
    });
    req.end();
};

module.exports = ProxyHelper;