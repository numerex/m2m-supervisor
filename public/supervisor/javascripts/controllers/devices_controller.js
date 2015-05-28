app.controller('DevicesController',['$scope','$rootScope','$http',function($scope,$rootScope,$http){

    $rootScope.globalMessages = {};
    $scope.devices = null;
    $scope.newDevice = {
        id: null,
        valuesKey: 'new-device',
        api: '/supervisor/api/device'
    };
    $scope.newDeviceID = {
        label: 'Device ID',
        key: 'id',
        value: null,
        exists: true,
        required: true,
        status: 'editable',
        success: function(){
            $rootScope.globalValues[$scope.newDevice.valuesKey].id = null;
            $rootScope.globalMessages = {success: 'New device added'};
            $scope.setupDevices();
        }
    };

    $scope.setupDevices = function (){
        $http.get('/supervisor/api/devices')
            .success(function(result){
                if (result.devices)
                    $scope.devices = _.map(result.devices || [],function(id){
                        return {
                            id: id,
                            valuesKey: 'device:' + id,
                            api: '/supervisor/api/device/' + id
                        };
                    });
                if (result.error)
                    $rootScope.globalMessages = {error: result.error};
                else
                    $rootScope.currentDeviceID = $scope.currentID = ($scope.devices[0] || $scope.newDevice).id;
            })
            .error(function (error){
                $scope.error = error;
            });
    };

    $scope.makeActive = function(device){
        $rootScope.globalMessages = {};
        $rootScope.currentDeviceID = $scope.currentID = device.id;
    };

    $scope.setupDevices();

}]);