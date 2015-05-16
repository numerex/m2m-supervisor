app.controller('ShellController',['$scope',function($scope){

    $scope.observer = { socketEvent: function(event,stdio,data){ if (event === 'ready') $scope.stdio = stdio; } };

}]);