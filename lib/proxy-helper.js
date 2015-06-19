var _ = require('lodash');
var url = require('url');
var util = require('util');
var events = require('events');

var logger = require('./logger')('proxy-help');

var schema = require('./redis-schema');

function ProxyHelper(client,proxy,config){
    var self = this;
    self.client = client;
    self.proxy = proxy;
    self.http  = require('http'); // NOTE delayed for testing
    self.timeoutInterval = (config || {}).timeoutInterval || 10*1000;

    self.on('checkProxyPeer',_.bind(self._checkProxyPeer,self));
    self.on('checkHost',_.bind(self._checkHost,self));
    self.on('checkResult',function(error){
        self.checkCallback && self.checkCallback(error,error || !self.proxy.hostname ? null : _.pick(self.proxy,'hostname','label'));
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
    var options = {method: method,hostname: self.proxy.hostname,port: 5000,path: '/supervisor/api' + path};
    if (body){
        body = JSON.stringify(body);
        options.headers = {'content-length':body.length,'content-type':'application/json;charset=UTF-8'};
    }

    var req = self.http.request(options,function(proxyRes){  // TODO make port configurable??
        if (proxyRes.statusCode !== 200) return res.send({error: 'Error: ' + proxyRes.statusCode + ' ' + proxyRes.statusMessage});

        var contentLength = +proxyRes.headers['content-length'];
        var bufferLength = 0;
        self.buffer = null;
        proxyRes.on('data',function(data){
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
                // istanbul ignore next - not sure how to generate this condition...
                logger.error('data error: ' + e.message);
            }
        });
    });
    req.on('error',function(error){
        logger.error('request error: ' + error.message);
        res.send({error: error.message});
    });
    if (body) req.write(body);
    req.end();
};

ProxyHelper.prototype.checkConfig = function(callback) {
    this.checkCallback = callback;
    this.emit('checkProxyPeer');
};

ProxyHelper.prototype._checkProxyPeer = function(){
    var self = this;
    self.client.get(schema.proxyPeer.key).thenHint('proxyPeer',function(proxyPeer){
        if (!proxyPeer) return self.emit('checkHost');

        if (!self.proxy.session) return self.emit('checkResult',new Error('No session given'));
        
        var https = require('https'); // NOTE delayed for testing
        
        var urlParts = url.parse(proxyPeer);
        self._setTimeout('proxy');
        var req = https.request(_.defaults({method: 'POST'},_.pick(urlParts,'hostname','port','path')),function(res){
            if (!self._clearTimeout('proxy')) return;

            if (res.statusCode === 200)
                self.emit('checkHost');
            else
                self.emit('checkResult',new Error(res.statusMessage));
        });
        req.on('error',function(error){
            if (!self._clearTimeout('proxy')) return;

            logger.error('check proxy error: ' + error.message);
            self.emit('checkResult',error);
        });
        req.write('session=' + self.proxy.session);
        req.end();
    });
};

ProxyHelper.prototype._checkHost = function(){
    var self = this;

    self._setTimeout('host');
    var req = self.http.request({method: 'GET',hostname: self.proxy.hostname || 'unknown',port: 5000,path: '/supervisor/api/check'},function(res){  // TODO make port configurable??
        if (!self._clearTimeout('host')) return;

        clearTimeout(self.hostTimeout);
        self.emit('checkResult',res.statusCode === 200 ? null : new Error(res.statusMessage));
    });
    req.on('error',function(error){
        if (!self._clearTimeout('host')) return;

        logger.error('check host error: ' + error.message);
        self.emit('checkResult',error);
    });
    req.end();
};

ProxyHelper.prototype._setTimeout = function(type){
    var self = this;
    var timeoutKey = type + 'Timeout';
    self[timeoutKey] = setTimeout(function(){
        clearTimeout(self[timeoutKey]);
        self[timeoutKey] = null;
        var message = 'Check ' + type + ' timeout';
        logger.error(message);
        self.emit('checkResult',new Error(message));
    },self.timeoutInterval);
};

ProxyHelper.prototype._clearTimeout = function(type){
    var timeoutKey = type + 'Timeout';
    if (!this[timeoutKey]) return false;

    clearTimeout(this[timeoutKey])
    this[timeoutKey] = null;
    return true;
};

module.exports = ProxyHelper;