app.controller('CommandsController',['$scope','$rootScope','$http',function($scope,$rootScope,$http){
    $scope.instanceID = ++$rootScope.instanceID;

    $rootScope.observer = $scope;

    $scope.socketEvent = function(event,stdio,data){
        switch(event){
            case 'ready':
                $scope.stdio = stdio;
                if ($scope.currentID) $scope.stdio.socket.emit('device',$scope.currentID);
                break;
            case 'note':
                if (!_.isUndefined(data.profile)) $scope.loadProfile(data.profile);
                break;
            case 'output':
                stdio.commandActive = false;
                break;
        }
    };


    $scope.loadProfile = function(profile){

        if (!$rootScope.profileDefinitions) $rootScope.profileDefinitions = [];
        if ($rootScope.profileDefinitions[profile])
            $scope.changeProfile(profile);
        else
            $http.get('/api/definitions/' + profile).success(function(profileDefinitions){
                $rootScope.profileDefinitions[profile] = _.map(_.values(profileDefinitions['definitions:' + profile] || {}),JSON.parse);
                $scope.changeProfile(profile);
            });
        
        if (!$rootScope.profileOptions) $rootScope.profileOptions = [];
        if ($rootScope.profileOptions[profile])
            $scope.changeProfile(profile);
        else
            $http.get('/api/options/' + profile).success(function(profileOptions){
                $rootScope.profileOptions[profile] = _.mapValues(profileOptions['options:' + profile] || {},JSON.parse);
                $scope.changeProfile(profile);
            });
    };
    
    $scope.changeProfile = function(profile){
        if ($scope.profile === profile || !$rootScope.profileOptions[profile] || !$rootScope.profileDefinitions[profile]) return;

        $scope.profile = profile;
        $scope.options = $rootScope.profileOptions[profile];

        if ($scope.options.command.length === 0)
            $scope.commandTypes = [
                {key: 'read',label: 'Read'},
                {key: 'write',label: 'Write'}
            ];
        else {
            $scope.commandTypes = [];
            _.each($scope.options.command,function(option){
                $scope.commandTypes.push({key: 'read:' + option,label: 'Read-' + _.startCase(option)});
                $scope.commandTypes.push({key: 'write:' + option,label: 'Write-' + _.startCase(option)});
            })
        }
        $scope.commandType = $scope.commandTypes[0];

        $scope.commandFilters = _.map(_.select(_.map($scope.options,function(value,key){ return _.isArray(value) && value.length === 1 ? key : null; })),function(option){
            return {key: option,label: _.startCase(option) };
        });

        $scope.changeCommandFilter($scope.commandFilters[0] || null);
    };

    $scope.changeCommandType = function(value){
        $scope.commandType = value;
        $scope.changeCurrentCommand($scope.currentCommand);
    };

    $scope.changeCommandFilter = function(value){
        $scope.commandFilter = value;
        $scope.definitions = $rootScope.profileDefinitions[$scope.profile];
        if (value) $scope.definitions = _.select($scope.definitions,function(definition) { return definition['attr:' + value.key]; });
    };

    $scope.changeCurrentCommand = function(value){
        $scope.inputFields = [];
        $scope.currentCommand = value;
        $scope.initialCommandLine();

        if (_.indexOf($scope.stdio.commandLine || '','{') < 0) return;

        var match = null;
        var regex = /{([^}]*)}/g;
        while (match = regex.exec($scope.stdio.commandLine)) {
            var parts = match[1].split(':');

            var options = null;
            if (parts[2])
                options = _.map(parts[2].split(','),function(option){
                    var pair = option.split('=');
                    return pair.length === 2 ? {key: pair[1],label: pair[0]} : {key: option, label: option};
                });

            $scope.inputFields.push({match: match[0], label: _.startCase(parts[0]),format: parts[1],options: options,value: options ? options[0] : null});
        }

        $scope.updateCommandLine();
    };

    $scope.changeFieldValue = function(field,value){
        field.value = value;
        $scope.updateCommandLine();
    };

    $scope.initialCommandLine = function(){
        $scope.stdio.commandLine = $scope.currentCommand && $scope.commandType ? $scope.currentCommand[$scope.commandType.key] : null;
    };

    $scope.updateCommandLine = function(){
        $scope.initialCommandLine();
        _.each($scope.inputFields,function(field){
            var value = _.padRight((field.value && typeof field.value === 'object' ? field.value.key : field.value) || field.format,field.format.length);
            $scope.stdio.commandLine = $scope.stdio.commandLine.replace(field.match,value);
        });
    };

    $scope.changeInputType = function(value){
        $rootScope.lastInputType = $scope.inputType = value;
    };

    $scope.changeCurrentID = function(value){
        if ($scope.currentID === value) return;

        $rootScope.currentDeviceID = $scope.currentID = value;
        if ($scope.stdio) $scope.stdio.socket.emit('device',value);
    };

    $scope.devices = [];
    $scope.currentID = $rootScope.currentDeviceID;
    $http.get('/api/devices').success(function(result){
        $scope.devices = result.devices || [];
        $scope.changeCurrentID($scope.devices[0]);
    });

    $scope.inputOptions = ['Guided','Raw'];
    $scope.inputType = $rootScope.lastInputType || $scope.inputOptions[0];

    $scope.profile = null;
}]);