app.directive('hashEditor',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/hashedit.jade',
        scope: {
            api:       '=api',
            valuesKey: '=valuesKey'
        },
        controller: ['$scope','$rootScope','$http',function($scope,$rootScope,$http){
            $scope.messages = {};

            $scope.setupHash = function(reset,result){
                $scope.hash = result[$scope.valuesKey];
                $scope.hashKeys = _.keys($scope.hash);
                $scope.hashValues = $rootScope.globalValues[$scope.valuesKey];
                if (reset || !$scope.hashValues) {
                    $rootScope.globalValues[$scope.valuesKey] = $scope.hashValues = {};
                    $scope.resetValues();
                }
                $scope.messages = {error: result.error};
            };

            $scope.resetValues = function(){
                _.each($scope.hash,function(group){
                    _.each(group,function(entry){
                        $scope.hashValues[entry.key] = entry.value;
                    });
                });
                $scope.messages = {};
            };

            $scope.requestHash = function(reset){
                $scope.messages = {};
                $http.get($scope.api)
                    .success(function(result){
                        $scope.setupHash(false,result);
                    })
                    .error(function (error){
                        $scope.messages.error = error;
                    });
            };

            $scope.submitChanges = function(){
                var dirty = {};
                _.each($scope.hash,function(group){
                    _.each(group,function(entry){
                        var value = $scope.hashValues[entry.key];
                        if (entry.type === 'number') value = +value;
                        if (value !== entry.value) dirty[entry.key] = value;
                    });
                });

                $scope.messages = {};
                if (_.keys(dirty).length == 0)
                    $scope.messages.warning = 'No changes';
                else {
                    $http.post($scope.api,dirty)
                        .success(function(result){
                            $scope.setupHash(true,result);
                            if (!$scope.messages.error)
                                $scope.messages.success = 'Changes saved';
                        })
                        .error(function(err){
                            $scope.messages.error = err;
                        })
                }
            };

            $scope.requestHash();
        }]
    };
});