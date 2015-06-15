var fs = require('fs');

function GlobalSetup()
{
}

GlobalSetup.prototype.reset = function(){
    try {
        // istanbul ignore next -- default file not testable on CI server
        this.setup = JSON.parse(fs.readFileSync(process.env.M2M_SUPERVISOR_CONFIG || '/etc/m2m-supervisor/setup.json'));
        this.error = null;
    } catch(error) {
        this.setup = null;
        this.error = error;
    }
    return this;
};

module.exports = new GlobalSetup().reset();