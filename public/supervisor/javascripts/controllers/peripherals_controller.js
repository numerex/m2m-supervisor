app.controller('PeripheralsController',['$scope','$rootScope','$http',function($scope,$rootScope,$http){

    $rootScope.globalMessages = {};
    $scope.peripherals = null;
    $scope.newPeripheral = {
        id: null,
        valuesKey: 'new-peripheral',
        api: '/supervisor/api/peripheral'
    };
    $scope.newPeripheralID = {
        label: 'Peripheral ID',
        key: 'id',
        value: null,
        exists: true,
        required: true,
        status: 'editable',
        success: function(){
            $rootScope.globalValues[$scope.newPeripheral.valuesKey].id = null;
            $rootScope.globalMessages = {success: 'New peripheral added'};
            $scope.setupPeripherals();
        }
    };

    $scope.setupPeripherals = function (){
        $http.get('/supervisor/api/peripherals')
            .success(function(result){
                if (result.peripherals)
                    $scope.peripherals = _.map(result.peripherals || [],function(id){
                        return {
                            id: id,
                            valuesKey: 'peripheral:' + id,
                            api: '/supervisor/api/peripheral/' + id
                        };
                    });
                if (result.error)
                    $rootScope.globalMessages = {error: result.error};
                else
                    $rootScope.currentPeripheralID = $scope.currentID = ($scope.peripherals[0] || $scope.newPeripheral).id;
            })
            .error(function (error){
                $scope.error = error;
            });
    };

    $scope.makeActive = function(peripheral){
        $rootScope.globalMessages = {};
        $rootScope.currentPeripheralID = $scope.currentID = peripheral.id;
    };

    $scope.setupPeripherals();

}]);