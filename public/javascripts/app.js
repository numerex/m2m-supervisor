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
            .state('config',{
                url: '#config',
                templateUrl: 'partials/config',
                controller: 'ConfigController',
                redirectTo: 'config'
            });
    }])
    .run(['$rootScope','$http','$timeout',function($rootScope,$http,$timeout) {

    }]);