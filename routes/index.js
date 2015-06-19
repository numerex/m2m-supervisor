var M2mSupervisor = require('../processes/m2m-supervisor');

var logger = require('../lib/logger')('api');

var express = require('express');
var router = express.Router();

router.get('/',function(req,res,next) {
    var proxyOnly = !!M2mSupervisor.instance && M2mSupervisor.instance.supervisorProxy;
    var title = proxyOnly ? 'M2M Proxy' : 'M2M Supervisor';
    if (req.session && req.session.proxy) title = req.session.proxy.label ? 'M2M Remote: ' + req.session.proxy.label : 'M2M Remote';
    res.render('supervisor/index',{title: title,proxyOnly: req.session && !req.session.proxy && proxyOnly});
});

module.exports = router;
