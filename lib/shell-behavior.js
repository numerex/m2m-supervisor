var logger = require('../lib/logger')('shell');

var childprocess = null;

function ShellBehavior(){
    var self = this;
    self.shell = require('shelljs'); // NOTE delay require for testability
    self.eventHandlers = [
        {event: 'input',callback: function(socket,input){ self.inputEvent(socket,input); }},
        {event: 'exit', callback: function(socket){ self.exitEvent(socket); }}
    ];
}

ShellBehavior.prototype.registerSelf = function(){
    require('./socket-server').registerBehavior('shell',this);
    return this;
};

ShellBehavior.prototype.inputEvent = function(socket,input){
    try {
        logger.info('input(' + socket.clientID + '): ' + JSON.stringify(input));

        var process = this.shell.exec(input.command,{silent: true,async: true});
        process.stdout.on('data',function(data){
            console.log('stdout:' + data);
            socket.emit('output',{id: socket.clientID,stdout: data.toString()});
        });
        process.stderr.on('data',function(data){
            console.log('stderr:' + data);
            socket.emit('output',{id: socket.clientID,stderr: data.toString()});
        });
        process.on('close',function(code,signal){
            console.log('close:' + code + ' ' + signal);
            socket.emit('close',{id: socket.clientID,code: code,signal: signal});
        });
        process.on('exit',function(code,signal){
            console.log('exit:' + code + ' ' + signal);
            socket.emit('exit',{id: socket.clientID,code: code,signal: signal});
        });
        process.on('error',function(){
           console.log('error');
            socket.emit('error',{id: socket.clientID,error: error});
        });
        socket.process = process;
    } catch(e) {
        logger.error('command error: ' + e);
        socket.emit({id: socket.clientID,error: e});
    }
};

ShellBehavior.prototype.exitEvent = function(socket){
    // TODO kill
};


module.exports = new ShellBehavior();