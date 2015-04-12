app.controller('ShellController',['$rootScope','$scope','$http','$location',function($rootScope,$scope,$http,$location){
    if (!$rootScope.shellSocket) {
        var socket = io($location.host() + ':' + $location.port());
        socket.on('indentified',function(data){
            console.log('indentified: ' + data);
        });
        socket.on('behavior',function(data){
            console.log('behavior: ' + data);
        });
        socket.on('close',function(data){
            console.log('close: ' + JSON.stringify(data));
        });
        socket.on('exit',function(data){
            console.log('exit: ' + JSON.stringify(data));
        });
        socket.on('output', function (data) {
            console.log('output: ' + JSON.stringify(data));
            displayOutput('stdout',data.stdout);
            displayOutput('stderr',data.stderr);
        });
        socket.on('connect',function(){
            console.log('connect');
            socket.emit('behavior','shell');
        });
        socket.on('disconnect',function(){
            console.log('disconnect');
        });
        socket.on('error',function(error){
            console.log('error:' + error);
        });
        socket.on('reconnect',function(number){
            console.log('reconnect:' + number);
        });
        socket.on('reconnect_attempt',function(){
            console.log('reconnect_attempt');
        });
        socket.on('reconnecting',function(number){
            console.log('reconnecting:' + number);
        });
        socket.on('reconnect_failed',function(){
            console.log('reconnect_failed');
        });
        $rootScope.shellSocket = socket;
    }

    var output = $('#shellOutput');
    var lineID = 0;
    $scope.clearOutput = function(){
        output.children('.shell-line').remove();
    };

    $scope.commandLine = '';
    $scope.executeCommand = function(){
        displayOutput('stdin','> ' + $scope.commandLine);
        $rootScope.shellSocket.emit('input',{command: $scope.commandLine});
        return true;
    };

    displayOutput = function(css,text){
        if (text)
            _.each(text.split('\n'),function(line){
                output.append('<div id="shell_line_' + lineID++ + '" class="shell-line ' + css +'">' + _.escape(line).replace(/ /g,'&nbsp;') + '</div>');
            });
    };

}]);