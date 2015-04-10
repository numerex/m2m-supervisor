app.controller('ConfigController',['$rootScope','$scope','$http',function($rootScope,$scope,$http){
    $scope.error = null;
    $scope.config = null;
    $scope.values = {};
    $http.get('/api/config').success(function(result){
        $scope.error = result.error;
        $scope.config = result.config;

    });

    $scope.submit = function(){
        console.log('SUBMIT!');
        console.dir($scope);
    };
}]);