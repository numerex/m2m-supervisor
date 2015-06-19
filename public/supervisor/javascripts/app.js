var app = angular.module('SupervisorApp',['ui.router','angular.filter'])
    .config(['$stateProvider','$urlRouterProvider','$locationProvider',function($stateProvider,$urlRouterProvider,$locationProvider) {
        $locationProvider.html5Mode(true);
        $urlRouterProvider
            .otherwise('/supervisor/');

        $stateProvider
            .state('home',{
                url: '/supervisor/',
                templateUrl: 'supervisor/partials/home',
                controller: 'HomeController',
                redirectTo: 'home'
            })
            .state('metrics',{
                url: '/supervisor/',
                templateUrl: 'supervisor/partials/metrics',
                controller: 'MetricsController',
                redirectTo: 'metrics'
            })
            .state('config',{
                url: '/supervisor/#config',
                templateUrl: 'supervisor/partials/config',
                controller: 'ConfigController',
                redirectTo: 'config'
            })
            .state('peripherals',{
                url: '/supervisor/#peripherals',
                templateUrl: 'supervisor/partials/peripherals',
                controller: 'PeripheralsController',
                redirectTo: 'peripherals'
            })
            .state('commands',{
                url: '/supervisor/#commands',
                templateUrl: 'supervisor/partials/commands',
                controller: 'CommandsController',
                redirectTo: 'commands'
            })
            .state('schedules',{
                url: '/supervisor/#schedules',
                templateUrl: 'supervisor/partials/schedules',
                controller: 'SchedulesController',
                redirectTo: 'schedules'
            })
            .state('status',{
                url: '/supervisor/#status',
                templateUrl: 'supervisor/partials/status',
                controller: 'StatusController',
                redirectTo: 'status'
            })
            .state('shell',{
                url: '/supervisor/#shell',
                templateUrl: 'supervisor/partials/shell',
                controller: 'ShellController',
                redirectTo: 'shell'
            });
    }])
    .run(['$rootScope','$http','$interval','$location',function($rootScope,$http,$interval,$location) {
        $rootScope.instanceID = 0;
        $rootScope.globalMessages = {};
        $rootScope.globalValues = {};
        $rootScope.globalStatus = {label: 'Status: Pending...',css: 'label-default'};

        var incomingError = $location.search().error;
        if (incomingError) $rootScope.globalMessages.error = incomingError;

        $rootScope.checkStatus = function(){
            $http.get('/supervisor/api/status')
                .success(function(result){
                    var total = 0;
                    var success = 0;
                    _.each(result,function(value){
                        total++;
                        if (value) success++;
                    });
                    if (total > success)
                        $rootScope.globalStatus = {label: 'Status: ERRORS',css: 'label-warning',breakdown: result};
                    else
                        $rootScope.globalStatus = {label: 'Status: OK',css: 'label-success',breakdown: result};
                    $rootScope.globalStatus.breakdown = _.pairs(result);
                })
                .error(function(){
                    $rootScope.globalStatus = {label: 'Status: DOWN',css: 'label-danger',error: 'Server connection failed'};
                })
        };
        $rootScope.checkStatus();
        $interval($rootScope.checkStatus,15*1000);

        $rootScope.setupSocket = function(flavor,callback) {
            if (!$rootScope.socket) {
                $rootScope.socket = io($location.host() + ':' + $location.port(),{path: '/supervisor/socket'});
                $rootScope.socket.flavors = {};

                $rootScope.socket.on('identified',function(data){
                    console.log('identified: ' + JSON.stringify(data));
                });
                $rootScope.socket.on('close',function(data){
                    console.log('close: ' + JSON.stringify(data));
                });
                $rootScope.socket.on('connect',function(){
                    console.log('connect');
                });
                $rootScope.socket.on('disconnect',function(){
                    console.log('disconnect');
                });
                $rootScope.socket.on('error',function(error){
                    console.log('error:' + error);
                });
                $rootScope.socket.on('reconnect',function(number){
                    console.log('reconnect:' + number);
                });
                $rootScope.socket.on('reconnect_attempt',function(){
                    console.log('reconnect_attempt');
                });
                $rootScope.socket.on('reconnecting',function(number){
                    console.log('reconnecting:' + number);
                });
                $rootScope.socket.on('reconnect_failed',function(){
                    console.log('reconnect_failed');
                });
                $rootScope.socket.on('ready',function(){
                    console.log('ready');
                });
                $rootScope.socket.on('busy',function(){
                    console.log('busy');
                });
            }
            if (!$rootScope.socket.flavors[flavor]) {
                $rootScope.socket.flavors[flavor] = true;
                callback && callback($rootScope.socket);
            }
            return $rootScope.socket;
        }


    }]);