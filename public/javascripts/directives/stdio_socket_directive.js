app.directive('stdioSocket',function(){
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'partials/stdio',
        scope: {
            behavior: '=behavior',
            observer: '=observer'
        },
        controller: ['$scope','$rootScope','$location',function($scope,$rootScope){
            $scope.instanceID = ++$rootScope.instanceID;

            $scope.socket = $rootScope.setupSocket('stdio',function(socket){
                socket.on('connect',function(){
                    socket.emit('behavior',socket.stdio.behavior);
                });
                socket.on('behavior',function(data){
                    console.log('behavior: ' + JSON.stringify(data) + ' ' + socket.stdio.instanceID);
                    socket.stdio.observer && socket.stdio.observer.socketEvent('behavior',socket.stdio,data);
                });
                socket.on('note',function(data){
                    console.log('note: ' + JSON.stringify(data));
                    socket.stdio.observer && socket.stdio.observer.socketEvent('note',socket.stdio,data);
                });
                socket.on('started',function(data){
                    console.log('started: ' + JSON.stringify(data));
                    if (data && data.command)
                        displayOutput('stdin','> ' + data.command);
                    socket.stdio.commandActive = true;
                    socket.stdio.observer && socket.stdio.observer.socketEvent('started',socket.stdio,data);
                    socket.stdio.$apply();
                });
                socket.on('output', function (data) {
                    console.log('output: ' + JSON.stringify(data));
                    displayOutput('stdin',data.stdin);
                    displayOutput('stdout',data.stdout);
                    displayOutput('stderr',data.stderr);
                    socket.stdio.observer && socket.stdio.observer.socketEvent('output',socket.stdio,data);
                    socket.stdio.$apply();
                });
                socket.on('exit',function(data){
                    console.log('exit: ' + JSON.stringify(data));
                    if (data && data.signal)
                        displayOutput('stderr','Command terminated');
                    socket.stdio.commandActive = false;
                    socket.stdio.observer && socket.stdio.observer.socketEvent('exit',socket.stdio,data);
                    socket.stdio.$apply();
                });
                socket.on('error',function(error){
                    displayOutput('socket-error',error);
                });
            });
            $scope.socket.stdio = $scope;
            if ($scope.socket.connected) $scope.socket.emit('behavior',$scope.behavior);

            $scope.lineID = 0;
            $scope.commandLine = null;
            $scope.observer && $scope.observer.socketEvent('ready',$scope,null);

            var outputDiv = $('#stdioOutput');
            $scope.clearOutput = function(){
                $scope.lineID = 0;
                outputDiv.children('.stdio-line').empty();
            };

            $scope.submitCommand = function(){
                $scope.observer && $scope.observer.socketEvent('submit',$scope,null);
            };

            $scope.killCommand = function(){
                $scope.observer && $scope.observer.socketEvent('kill',$scope,null);
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