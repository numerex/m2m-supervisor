var logger = require('../lib/logger')('shell');

var childprocess = null;

function ShellBehavior(){
    var self = this;
    self.shell = require('shelljs'); // NOTE delay require for testability
    self.eventHandlers = [
        {event: 'input',callback: function(socket,data){ self.inputEvent(socket,data); }},
        {event: 'kill', callback: function(socket,data){ self.killEvent(socket,data); }}
    ];
}

ShellBehavior.prototype.registerSelf = function(){
    require('./socket-server').registerBehavior('shell',this);
    return this;
};

ShellBehavior.prototype.closeEvent = function(socket) {
    logger.info('close(' + socket.clientID + ')');
    this.killActiveProcess(socket);
};

ShellBehavior.prototype.disconnectEvent = function(socket) {
    logger.info('disconnect(' + socket.clientID + ')');
    this.killActiveProcess(socket); // TODO perhaps use a timeout before killing the active process to allow a reconnect
};

ShellBehavior.prototype.killActiveProcess = function(socket){
    if (socket.process)
        socket.process.kill('SIGTERM');
};


ShellBehavior.prototype.inputEvent = function(socket,input){
    try {
        logger.info('input(' + socket.clientID + '): ' + JSON.stringify(input));

        if (socket.process)
            socket.emit('output',{id: socket.clientID,stderr: 'A command is already active'});
        else {
            var process = this.shell.exec(input.command,{silent: true,async: true});
            socket.lastCommand = input.command;
            socket.emit('started',{id: socket.clientID,command: input.command});
            process.stdout.on('data',function(data){
                //console.log('stdout:' + data);
                socket.emit('output',{id: socket.clientID,stdout: data.toString()});
            });
            process.stderr.on('data',function(data){
                //console.log('stderr:' + data);
                socket.emit('output',{id: socket.clientID,stderr: data.toString()});
            });
            process.on('close',function(code,signal){
                console.log('close:' + code + ' ' + signal);
                socket.emit('close',{id: socket.clientID,code: code,signal: signal});
                socket.process = null;
            });
            process.on('exit',function(code,signal){
                //console.log('exit:' + code + ' ' + signal);
                socket.emit('exit',{id: socket.clientID,code: code,signal: signal});
                socket.process = null;
            });
            process.on('error',function(){
                //console.log('error');
                socket.emit('output',{id: socket.clientID,stderr: error});
            });
            socket.process = process;
        }
    } catch(e) {
        logger.error('command error: ' + e);
        socket.emit({id: socket.clientID,error: e});
    }
};

ShellBehavior.prototype.killEvent = function(socket,data){
    logger.info('kill(' + socket.clientID + ')-' + socket.lastCommand + '-' + (socket.process ? 'active: ' : 'done: ') + JSON.stringify(data));
    if (socket.process)
        socket.process.kill(data && data.signal);
    else
        socket.emit('output',{id: socket.clientID,stderr: 'No active command'});
};


module.exports = new ShellBehavior();