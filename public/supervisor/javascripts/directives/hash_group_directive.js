app.directive('hashGroup',function(){
    return {
        restrict: 'E',
        templateUrl: 'supervisor/partials/hashgroup',
        scope: {
            name: '=name',
            group: '=group',
            hashValues: '=hashValues'
        }
    };
});