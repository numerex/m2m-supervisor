app.controller('ConfigController',['$scope','$rootScope',function($scope,$rootScope){
    $rootScope.globalMessages = {};
    $scope.valuesKey = 'config';
    $scope.api = '/supervisor/api/config';
}]);