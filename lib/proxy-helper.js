function ProxyHelper(config){
    this.config = config;
}

ProxyHelper.prototype.checkConfig = function(callback){
    callback && callback(new Error('Invalid proxy'),null);
};

module.exports = ProxyHelper;