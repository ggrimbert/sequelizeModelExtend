const Model = require('sequelize/lib/model');
const _ = require('lodash');
 
/* TODO A REVOIR !*/
module.exports = function ModelExtend(option) {
	const self = class extends this {};
	let scope;
	let scopeName;
	Object.defineProperty(self, 'name', {value: this.name});

	self._scope = {};
	self.scoped = true;

	if (!option) {
	return self;
	}

	const options = _.flatten(arguments);
	for (const option of options) {
	scope = null;
	scopeName = null;

		if (_.isPlainObject(option)) {
			if (option.method) {
				if (Array.isArray(option.method) && !!self.options.scopes[option.method[0]]) {
					scopeName = option.method[0];
					scope = self.options.scopes[scopeName].apply(self, option.method.slice(1));
				} else if (self.options.scopes[option.method]) {
					scopeName = option.method;
					scope = self.options.scopes[scopeName].apply(self);
				}
			} else {
			scope = option;
			}
		} else {
			if (option === 'defaultScope' && _.isPlainObject(self.options.defaultScope)) {
				scope = self.options.defaultScope;
			} else {
				scopeName = option;
				scope = self.options.scopes[scopeName];

				if (_.isFunction(scope)) {
					scope = scope();
					require('sequelize/lib/model')._conformOptions(scope, self);
				}
			}
		}

		if (scope) {
			_.assignWith(self._scope, scope, (objectValue, sourceValue, key) => {
				if (key === 'where') {
					var sourceArray = Array.isArray(sourceValue) ? sourceValue : _.assign(objectValue || {}, sourceValue);
					if (!objectValue) {
						objectValue = []; 
					}
					return objectValue.concat(sourceArray);
				} else if (['attributes', 'include'].indexOf(key) >= 0 && Array.isArray(objectValue) && Array.isArray(sourceValue)) {
					return objectValue.concat(sourceValue);
				}
				return objectValue ? objectValue : sourceValue;
			});
		} else {
			throw new sequelizeErrors.SequelizeScopeError('Invalid scope ' + scopeName + ' called.');
		}
	}

	return self;
};