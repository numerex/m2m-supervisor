app.controller('ConfigController',['$rootScope','$scope','$http',function($rootScope,$scope,$http){
    $scope.setupConfig = function(reset,result){
        $scope.config = result.config;
        if (reset || !$rootScope.configValues) {
            $rootScope.configValues = {};
            $scope.resetValues();
        }
        $scope.successMessage = null;
        $scope.warningMessage = null;
        $scope.errorMessage = result.error;
    };

    $scope.resetValues = function(){
        _.each($scope.config,function(entry){
            $rootScope.configValues[entry.key] = entry.value;
        });
        $scope.successMessage = null;
        $scope.warningMessage = null;
        $scope.errorMessage = null;
    };

    $scope.requestConfig = function(reset){
        $http.get('/api/config')
            .success(function(result){
                $scope.setupConfig(false,result);
            })
            .error(function (error){
                $scope.error = error;
            });
    };

    $scope.submitChanges = function(){
        var dirty = {};
        _.each($scope.config,function(entry){
            var value = $rootScope.configValues[entry.key];
            if (entry.type === 'number') value = +value;
            if (value !== entry.value) dirty[entry.key] = value;
        });

        $scope.successMessage = null;
        $scope.warningMessage = null;
        $scope.errorMessage = null;
        if (_.keys(dirty).length == 0)
            $scope.warningMessage = 'No changes';
        else {
            $http.post('/api/config',dirty)
                .success(function(result){
                    $scope.setupConfig(true,result);
                    if (!$scope.errorMessage)
                        $scope.successMessage = 'Changes saved';
                })
                .error(function(err){
                    $scope.errorMessage = err;
                })
        }
    };

    $scope.requestConfig();
}]);