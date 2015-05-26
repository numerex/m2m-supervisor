app.directive('hashGroup',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/hashgroup',
        scope: {
            name: '=name',
            group: '=group',
            hashValues: '=hashValues'
        }
    };
});