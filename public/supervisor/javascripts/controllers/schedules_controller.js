app.controller('SchedulesController',['$rootScope','$scope','$http',function($rootScope,$scope,$http){

    $rootScope.globalMessages = {};
    $scope.schedules = null;
    $scope.newSchedule = {
        id: null,
        valuesKey: 'new-schedule',
        api: '/api/schedule'
    };
    $scope.newScheduleID = {
        label: 'Schedule ID',
        key: 'id',
        value: null,
        exists: true,
        required: true,
        success: function(){
            $rootScope.globalValues[$scope.newSchedule.valuesKey].id = null;
            $rootScope.globalMessages = {success: 'New schedule added'};
            $scope.setupSchedules();
        }
    };

    $scope.setupSchedules = function (){
        $http.get('/supervisor/api/schedules')
            .success(function(result){
                if (result.schedules)
                    $scope.schedules = _.map(result.schedules || [],function(id){
                        return {
                            id: id,
                            valuesKey: 'schedule:' + id,
                            api: '/supervisor/api/schedule/' + id
                        };
                    });
                if (result.error)
                    $rootScope.globalMessages = {error: result.error};
                else
                    $scope.makeActive($scope.schedules[0] || $scope.newSchedule);
            })
            .error(function (error){
                $scope.error = error;
            });
    };

    $scope.makeActive = function(schedule){
        $rootScope.globalMessages = {};
        $scope.currentID = schedule.id;
        if (schedule.id && !schedule.periods)
            $http.get(schedule.api)
                .success(function(result){
                    schedule.periods = result[schedule.valuesKey] || [];
                    if (result.error) $rootScope.globalMessages = {error: result.error};
                })
                .error(function(error){
                    $scope.error = error;
                })
    };

    $scope.setupSchedules();
    
}]);