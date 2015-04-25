app.controller('DevicesController',['$scope','$rootScope','$http',function($scope,$rootScope,$http){

    $rootScope.globalMessages = {};
    $scope.devices = null;
    $scope.newDevice = {
        id: null,
        valuesKey: 'new-device',
        api: '/api/device'
    };
    $scope.newDeviceID = {
        label: 'Device ID',
        key: 'id',
        value: null,
        exists: true,
        required: true,
        success: function(){
            $rootScope.globalValues[$scope.newDevice.valuesKey].id = null;
            $rootScope.globalMessages = {success: 'New device added'};
            $scope.setupDevices();
        }
    };

    $scope.setupDevices = function (){
        $http.get('/api/devices')
            .success(function(result){
                if (result.devices)
                    $scope.devices = _.map(result.devices || [],function(id){
                        return {
                            id: id,
                            valuesKey: 'device:' + id,
                            api: '/api/device/' + id
                        };
                    });
                if (result.error)
                    $rootScope.globalMessages = {error: result.error};
                else
                    $scope.currentID = ($scope.devices[0] || $scope.newDevice).id;
            })
            .error(function (error){
                $scope.error = error;
            });
    };

    $scope.makeActive = function(device){
        $rootScope.globalMessages = {};
        $scope.currentID = device.id;
    };

    $scope.setupDevices();

}]);