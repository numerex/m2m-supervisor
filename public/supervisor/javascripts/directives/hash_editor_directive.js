app.directive('hashEditor',function(){
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: 'supervisor/partials/hashedit',
        scope: {
            extra:     '=extra',
            api:       '=api',
            valuesKey: '=valuesKey'
        },
        controller: ['$scope','$rootScope','$http',function($scope,$rootScope,$http){
            $scope.setupHash = function(reset,result){
                var newHash = result[$scope.valuesKey];
                if (newHash)
                    $scope.hash = newHash;
                else
                    reset = false;
                $scope.hashKeys = _.keys($scope.hash);
                $scope.hashValues = $rootScope.globalValues[$scope.valuesKey];
                if (reset || !$scope.hashValues) {
                    $rootScope.globalValues[$scope.valuesKey] = $scope.hashValues = {};
                    $scope.resetValues(true);
                }
                if (result.error)
                    $rootScope.globalMessages = {error: result.error};
            };

            $scope.resetValues = function(keepMessages){
                if ($scope.extra)
                    $scope.hashValues[$scope.extra.key] = $scope.extra.value;
                _.each($scope.hash,function(group){
                    _.each(group,function(entry){
                        $scope.hashValues[entry.key] = entry.value;
                    });
                });
                if (!keepMessages) $rootScope.globalMessages = {};
            };

            $scope.requestHash = function(){
                $http.get($scope.api)
                    .success(function(result){
                        $scope.setupHash(false,result);
                    })
                    .error(function (error){
                        $rootScope.globalMessages = {error: error || 'Request failed'};
                    });
            };

            function buildDirtyList(dirty,entry) {
                var value = $scope.hashValues[entry.key];
                if (!_.isUndefined(value) && entry.type === 'number') value = +value;
                if (value !== entry.value || (!entry.exists && value !== entry.default)) dirty[entry.key] = value || null;
            }

            $scope.submitChanges = function(){
                var dirty = {};
                if ($scope.extra)
                    buildDirtyList(dirty,$scope.extra);
                _.each($scope.hash,function(group){
                    _.each(group,function(entry){
                        buildDirtyList(dirty,entry)
                    });
                });

                if (_.keys(dirty).length == 0)
                    $rootScope.globalMessages = {warning: 'No changes'};
                else {
                    $http.post($scope.api,dirty)
                        .success(function(result){
                            if (!result.error && $scope.extra && $scope.extra.success)
                                $scope.extra.success(result);
                            else {
                                $scope.setupHash(true,result);
                                if (!$rootScope.globalMessages.error)
                                    $rootScope.globalMessages= {success: 'Changes saved'};
                            }
                        })
                        .error(function(err){
                            $rootScope.globalMessages = {error: err};
                        })
                }
            };

            $scope.requestHash();
        }]
    };
});