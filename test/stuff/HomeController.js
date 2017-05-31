var HomeController, deps, ngcontroller,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

deps = ['lib/AbstractController'];

/* locals = AbstractController */

ngcontroller = HomeController = (function(superClass) {
  extend(HomeController, superClass);

  var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;
  [/^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/];
  function fn() { /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/ }

  function HomeController() {
    return HomeController.__super__.constructor.apply(this, arguments);
  }

  HomeController.prototype.indexAction = AbstractController.prototype.inject(['$routeParams'], function($routeParams) {
    this.innerTemplate = this.resolvePath('../templates/home/' + $routeParams.language + '/index.html');
    this.$templateUrl = this.resolvePath('../templates/home/index.html');
  });

  HomeController.prototype.aboutAction = function() {
    this.$template = 'ABOUT';
  };

  return HomeController;

})(AbstractController);