app.directive('stdioSocket',function(){
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'partials/stdio.jade',
        scope: {
            behavior: '=behavior',
            observer: '=observer'
        },
        controller: ['$scope','$rootScope','$location',function($scope,$rootScope,$location){
            $scope.instanceID = ++$rootScope.instanceID;

            var socketName = $scope.behavior + 'Socket';
            $scope.commandActive = false;
            if ($rootScope[socketName])
                $scope.socket = $rootScope[socketName];
            else {
                $scope.socket = io($location.host() + ':' + $location.port());
                $scope.socket.on('indentified',function(data){
                    console.log('indentified: ' + data);
                });
                $scope.socket.on('close',function(data){
                    console.log('close: ' + JSON.stringify(data));
                });
                $scope.socket.on('connect',function(){
                    console.log('connect');
                    $scope.socket.emit('behavior',$scope.behavior);
                });
                $scope.socket.on('disconnect',function(){
                    console.log('disconnect');
                });
                $scope.socket.on('error',function(error){
                    console.log('error:' + error);
                    displayOutput('socket-error',error);
                });
                $scope.socket.on('reconnect',function(number){
                    console.log('reconnect:' + number);
                });
                $scope.socket.on('reconnect_attempt',function(){
                    console.log('reconnect_attempt');
                });
                $scope.socket.on('reconnecting',function(number){
                    console.log('reconnecting:' + number);
                });
                $scope.socket.on('reconnect_failed',function(){
                    console.log('reconnect_failed');
                });

                $scope.socket.on('behavior',function(data){
                    console.log('behavior: ' + JSON.stringify(data));
                    $scope.observer && $scope.observer.socketEvent('behavior',$scope,data);
                });
                $scope.socket.on('note',function(data){
                    console.log('note: ' + JSON.stringify(data));
                    $scope.observer && $scope.observer.socketEvent('note',$scope,data);
                });
                $scope.socket.on('started',function(data){
                    console.log('started: ' + JSON.stringify(data));
                    if (data && data.command)
                        displayOutput('stdin','> ' + data.command);
                    $scope.commandActive = true;
                    $scope.observer && $scope.observer.socketEvent('started',$scope,data);
                    $scope.$apply();
                });
                $scope.socket.on('output', function (data) {
                    console.log('output: ' + JSON.stringify(data));
                    displayOutput('stdin',data.stdin);
                    displayOutput('stdout',data.stdout);
                    displayOutput('stderr',data.stderr);
                    $scope.observer && $scope.observer.socketEvent('output',$scope,data);
                    $scope.$apply();
                });
                $scope.socket.on('exit',function(data){
                    console.log('exit: ' + JSON.stringify(data));
                    if (data && data.signal)
                        displayOutput('stderr','Command terminated');
                    $scope.commandActive = false;
                    $scope.observer && $scope.observer.socketEvent('exit',$scope,data);
                    $scope.$apply();
                });

                $rootScope[socketName] = $scope.socket;
            }

            $scope.lineID = 0;
            $scope.commandLine = null;
            $scope.observer && $scope.observer.socketEvent('ready',$scope,null);

            var outputDiv = $('#stdioOutput');
            $scope.clearOutput = function(){
                $scope.lineID = 0;
                outputDiv.children('.stdio-line').empty();
            };

            $scope.executeCommand = function(){
                $scope.socket.emit('input',{command: $scope.commandLine});
            };

            $scope.killCommand = function(){
                $rootScope.shellSocket.emit('kill',{signal: 'SIGTERM'});
            };

            var MAX_LINES = 100;

            displayOutput = function(css,text){
                if (text)
                    _.each(text.split('\n'),function(line){
                        if (++$scope.lineID > MAX_LINES)
                            $('#stdio_line_' + ($scope.lineID - MAX_LINES)).empty();
                        outputDiv.append('<div id="stdio_line_' + $scope.lineID + '" class="stdio-line ' + css +'">' + _.escape(line).replace(/ /g,'&nbsp;') + '</div>');
                    });
            };
        }]
    };
});