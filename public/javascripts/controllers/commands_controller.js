app.controller('CommandsController',['$rootScope','$scope','$http','$location',function($rootScope,$scope,$http,$location){
    $scope.commandActive = false;
    if (!$rootScope.commandSocket) {
        var socket = io($location.host() + ':' + $location.port());
        socket.on('indentified',function(data){
            console.log('indentified: ' + data);
        });
        socket.on('behavior',function(data){
            console.log('behavior: ' + JSON.stringify(data));
        });
        socket.on('started',function(data){
            console.log('started: ' + JSON.stringify(data));
            if (data && data.command)
                displayOutput('stdin','> ' + data.command);
            $scope.commandActive = true;
            $scope.$apply();
        });
        socket.on('close',function(data){
            console.log('close: ' + JSON.stringify(data));
        });
        socket.on('output', function (data) {
            console.log('output: ' + JSON.stringify(data));
            displayOutput('stdout',data.stdout);
            displayOutput('stderr',data.stderr);
            $scope.commandActive = false;
        });
        socket.on('connect',function(){
            console.log('connect');
            socket.emit('behavior','command');
        });
        socket.on('disconnect',function(){
            console.log('disconnect');
        });
        socket.on('error',function(error){
            console.log('error:' + error);
            displayOutput('socket-error',error);
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
        $rootScope.commandSocket = socket;
    }

    $scope.lineID = 0;

    var output = $('#commandOutput');
    $scope.clearOutput = function(){
        $scope.lineID = 0;
        output.children('.shell-line').empty();
    };

    $scope.commandLine = '';
    $scope.executeCommand = function(){
        $rootScope.commandSocket.emit('input',{command: $scope.commandLine,device: $rootScope.currentDeviceID});
    };

    var MAX_LINES = 100;

    displayOutput = function(css,text){
        if (text)
            _.each(text.split('\n'),function(line){
                if (++$scope.lineID > MAX_LINES)
                    $('#shell_line_' + ($scope.lineID - MAX_LINES)).empty();
                output.append('<div id="shell_line_' + $scope.lineID + '" class="shell-line ' + css +'">' + _.escape(line).replace(/ /g,'&nbsp;') + '</div>');
            });
    };

}]);