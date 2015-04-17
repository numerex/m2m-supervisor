app.controller('DevicesController',['$scope','$http',function($scope,$http){

    $scope.devices = null;
    $http.get('/api/devices')
        .success(function(result){
            $scope.devices = _.map(result,function(value){ return {label: value,id: value }; }).concat({label: 'New Device',id: null});
            _.each($scope.devices,function(device){
                device.valuesKey = 'device:' + (device.id || 'new');
                device.api = device.id ? '/api/device/' + device.id : '/api/device';
            });
            $scope.makeActive($scope.devices[0]);
        })
        .error(function (error){
            $scope.error = error;
        });

    $scope.testActive = function(device){
        return device.id === $scope.currentID;
    };

    $scope.makeActive = function(device){
        $scope.currentID = device.id;
        $scope.currentKey = 'device:' + (device.id || 'new');
        $scope.currentAPI = device.id ? '/api/device/' + device.id : '/api/device'
    };

}]);