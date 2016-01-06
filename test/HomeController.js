var deps, ngcontroller, ngdeps,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

deps = ['lib/AbstractController'];


/* locals = AbstractController */

ngdeps = ['$scope'];

ngcontroller = function() {
  var HomeController;
  return HomeController = (function(superClass) {
    extend(HomeController, superClass);

    function HomeController(scope) {
      this.scope = scope;
    }

    HomeController.prototype.step2Action = function() {
      this.$templateUrl = this.resolvePath('../templates/home/step-2.html');
      this.scope.phones = [
        {
          'name': 'Nexus S',
          'snippet': 'Fast just got faster with Nexus S.'
        }, {
          'name': 'Motorola XOOM™ with Wi-Fi',
          'snippet': 'The Next, Next Generation tablet.'
        }, {
          'name': 'MOTOROLA XOOM™',
          'snippet': 'The Next, Next Generation tablet.'
        }
      ];
    };

    HomeController.prototype.step3Action = function() {
      this.$templateUrl = this.resolvePath('../templates/home/step-3.html');
      this.scope.phones = [
        {
          'name': 'Nexus S',
          'snippet': 'Fast just got faster with Nexus S.'
        }, {
          'name': 'Motorola XOOM™ with Wi-Fi',
          'snippet': 'The Next, Next Generation tablet.'
        }, {
          'name': 'MOTOROLA XOOM™',
          'snippet': 'The Next, Next Generation tablet.'
        }
      ];
    };

    HomeController.prototype.step4Action = function() {
      this.$templateUrl = this.resolvePath('../templates/home/step-4.html');
      this.scope.phones = [
        {
          'name': 'Nexus S',
          'snippet': 'Fast just got faster with Nexus S.',
          'age': 1
        }, {
          'name': 'Motorola XOOM™ with Wi-Fi',
          'snippet': 'The Next, Next Generation tablet.',
          'age': 2
        }, {
          'name': 'MOTOROLA XOOM™',
          'snippet': 'The Next, Next Generation tablet.',
          'age': 3
        }
      ];
      this.scope.orderProp = 'age';
    };

    return HomeController;

  })(AbstractController);
};
