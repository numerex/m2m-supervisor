app.directive('hashGroup',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/hashgroup.jade',
        scope: {
            name: '=name',
            group: '=group',
            hashValues: '=hashValues'
        }
    };
});