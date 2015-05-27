var M2mSupervisor = require('../processes/m2m-supervisor');

var logger = require('../lib/logger')('api');

var express = require('express');
var router = express.Router();

router.get('/',function(req,res,next) {
    // istanbul ignore next -- TODO figure out how to test w/o damaging M2mSupervisor
    res.render('supervisor/index',{proxyOnly: !req.session.proxy && !!M2mSupervisor.instance && M2mSupervisor.instance.supervisorProxy});
});

module.exports = router;
