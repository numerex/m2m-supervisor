app.directive('alertMessage',function(){
    return {
        restrict: 'E',
        templateUrl: 'supervisor/partials/alertmessage',
        scope: {
            messages: '=messages'
        }
    };
});