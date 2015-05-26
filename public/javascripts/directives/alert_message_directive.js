app.directive('alertMessage',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/alertmessage',
        scope: {
            messages: '=messages'
        }
    };
});