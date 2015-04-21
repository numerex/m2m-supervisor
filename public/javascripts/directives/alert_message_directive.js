app.directive('alertMessage',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/alertmessage.jade',
        scope: {
            messages: '=messages'
        }
    };
});