var app = angular.module('SupervisorApp',['ui.router','angular.filter'])
    .config(['$stateProvider','$urlRouterProvider','$locationProvider',function($stateProvider,$urlRouterProvider,$locationProvider) {
        $locationProvider.html5Mode(true);
        $urlRouterProvider
            .otherwise('/');

        $stateProvider
            .state('home',{
                url: '/',
                templateUrl: 'partials/home',
                controller: 'HomeController',
                redirectTo: 'home'
            })
            .state('metrics',{
                url: '/',
                templateUrl: 'partials/metrics',
                controller: 'MetricsController',
                redirectTo: 'metrics'
            })
            .state('config',{
                url: '#config',
                templateUrl: 'partials/config',
                controller: 'ConfigController',
                redirectTo: 'config'
            })
            .state('status',{
                url: '#status',
                templateUrl: 'partials/status',
                controller: 'StatusController',
                redirectTo: 'status'
            })
            .state('shell',{
                url: '#shell',
                templateUrl: 'partials/shell',
                controller: 'ShellController',
                redirectTo: 'shell'
            });
    }])
    .run(['$rootScope','$http','$interval',function($rootScope,$http,$interval) {
        $rootScope.globalStatus = {label: 'Status: Pending...',css: 'label-default'};
        $rootScope.checkStatus = function(){
            $http.get('/api/status')
                .success(function(result){
                    var total = 0;
                    var success = 0;
                    _.each(result,function(value,key){
                        total++;
                        if (value) success++;
                    });
                    if (!result.redis || !(result.modem || result.ethernet))
                        $rootScope.globalStatus = {label: 'Status: DOWN',css: 'label-danger'};
                    else if (total > success)
                        $rootScope.globalStatus = {label: 'Status: ERRORS',css: 'label-warning',breakdown: result};
                    else
                        $rootScope.globalStatus = {label: 'Status: OK',css: 'label-success',breakdown: result};
                    $rootScope.globalStatus.breakdown = _.pairs(result);
                })
                .error(function(result){
                    $rootScope.globalStatus = {label: 'Status: DOWN',css: 'label-danger',error: 'Server connection failed'};
                })
        };
        $rootScope.checkStatus();
        $interval($rootScope.checkStatus,15*1000);

    }]);