app.controller('ShellController',['$scope',function($scope){

    $scope.observer = $scope;

    $scope.socketEvent = function(event,stdio,data){
        switch(event){
            case 'ready':
                $scope.stdio = stdio;
                break;
            case 'submit':
                stdio.socket.emit('input',{command: stdio.commandLine});
                break;
            case 'kill':
                stdio.socket.emit('kill',{signal: 'SIGTERM'});
                break;
        }
    };

}]);