app.directive('hashInput',function(){
    return {
        restrict: 'E',
        templateUrl: 'partials/hashinput.jade',
        scope: {
            model: '=model',
            hashValues: '=hashValues'
        },
        link: function(scope){
            scope.showAction = false;
            scope.disableAction = false;
            scope.isDisabled = scope.model.status === 'locked';
            scope.isSelect = !!scope.model.options;
            scope.isText = !scope.isSelect;
            if (scope.isSelect && _.isUndefined(scope.hashValues[scope.model.key]))
                scope.hashValues[scope.model.key] = scope.model.default;
            else if (scope.isText && !scope.isDisabled) {
                scope.placeholder = scope.model.default || ('Enter ' + scope.model.label);
                scope.showAction = true;
                if (scope.model.exists) {
                    scope.actionName = 'Del';
                    scope.executeAction = function(){

                    }
                } else {
                    delete scope.model.value;
                    scope.actionName = 'Add';
                    scope.executeAction = function(){

                    }
                }
            }
        }
    };
});