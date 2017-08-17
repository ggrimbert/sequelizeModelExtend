const Model = require('sequelize/lib/model');
const _ = require('lodash');
const Promise = require('sequelize/lib/promise');
const sequelizeErrors = require('sequelize/lib/errors');
const Sequelize = require("sequelize");
const retry = require('retry-as-promised');
const Utils = require('sequelize/lib/utils');
const QueryTypes = require('sequelize/lib/query-types');
 
/* TODO A REVOIR !*/
module.exports.ModelExtend = function ModelExtend(option) {
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
		
/**
 * @override (Sequelize.js)
 * Override de la fonction query qui se trouve dans Sequelize (modification -> @ggrimbert)
 * Permet de gérer la perte / récupération de connexion à la base de données
 */
module.exports.SequelizeQuery = function SequelizeQuery(sql, options) {
let bindParameters;

return Promise.try(() => {
	options = _.assign({}, this.options.query, options);

	if (options.instance && !options.model) {
	options.model = options.instance.constructor;
	}

	// Map raw fields to model field names using the `fieldAttributeMap`
	if (options.model && options.mapToModel && !Utils._.isEmpty(options.model.fieldAttributeMap)) {
	options.fieldMap =  options.model.fieldAttributeMap;
	}

	if (typeof sql === 'object') {
	if (sql.values !== undefined) {
		if (options.replacements !== undefined) {
		throw new Error('Both `sql.values` and `options.replacements` cannot be set at the same time');
		}
		options.replacements = sql.values;
	}

	if (sql.bind !== undefined) {
		if (options.bind !== undefined) {
		throw new Error('Both `sql.bind` and `options.bind` cannot be set at the same time');
		}
		options.bind = sql.bind;
	}

	if (sql.query !== undefined) {
		sql = sql.query;
	}
	}

	sql = sql.trim();

	if (!options.instance && !options.model) {
	options.raw = true;
	}

	if (options.replacements && options.bind) {
	throw new Error('Both `replacements` and `bind` cannot be set at the same time');
	}

	if (options.replacements) {
	if (Array.isArray(options.replacements)) {
		sql = Utils.format([sql].concat(options.replacements), this.options.dialect);
	} else {
		sql = Utils.formatNamedParameters(sql, options.replacements, this.options.dialect);
	}
	}

	if (options.bind) {
	const bindSql = this.dialect.Query.formatBindParameters(sql, options.bind, this.options.dialect);
	sql = bindSql[0];
	bindParameters = bindSql[1];
	}

	options = _.defaults(options, {
	logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
	searchPath: this.options.hasOwnProperty('searchPath') ? this.options.searchPath : 'DEFAULT'
	});

	if (options.transaction === undefined && Sequelize._cls) {
	options.transaction = Sequelize._cls.get('transaction');
	}
	
	//@ggrimbert
	//force the reconnection to the db (usefull after a connection loss)
	if (options.transaction && !options.transaction.connection) {
	this.connectionManager.reconnect();
	}

	if (!options.type) {
	if (options.model || options.nest || options.plain) {
		options.type = QueryTypes.SELECT;
	} else {
		options.type = QueryTypes.RAW;
	}
	}

	if (options.transaction && options.transaction.finished) {
	const error = new Error(options.transaction.finished+' has been called on this transaction('+options.transaction.id+'), you can no longer use it. (The rejected query is attached as the \'sql\' property of this error)');
	error.sql = sql;
	return Promise.reject(error);
	}

	if (this.test._trackRunningQueries) {
	this.test._runningQueries++;
	}

	//if dialect doesn't support search_path or dialect option
	//to prepend searchPath is not true delete the searchPath option
	if (!this.dialect.supports.searchPath || !this.options.dialectOptions || !this.options.dialectOptions.prependSearchPath ||
	options.supportsSearchPath === false) {
	delete options.searchPath;
	} else if (!options.searchPath) {
	//if user wants to always prepend searchPath (dialectOptions.preprendSearchPath = true)
	//then set to DEFAULT if none is provided
	options.searchPath = 'DEFAULT';
	}
	return options.transaction ? options.transaction.connection : this.connectionManager.getConnection(options);
}).then(connection => {
	const query = new this.dialect.Query(connection, this, options);

	return retry(() => query.run(sql, bindParameters).finally(() => {
	if (!options.transaction) {
		return this.connectionManager.releaseConnection(connection);
	}
	}), Utils._.extend(this.options.retry, options.retry || {}));
})
//@ggrimbert
//Added for handling the connection error if there are no transaction
.catch(err => {
	if (err instanceof sequelizeErrors.ConnectionError) {
	this.options.connectionLost = true;
	// delete this.options.databaseVersion;
	}
	throw err;
})
.finally(() => {
	if (this.test._trackRunningQueries) {
	this.test._runningQueries--;
	}
});
}


/**
 * Permet de forcer une reconnexion à la base de données
 */
module.exports.ConnectionManagerReconnect = function ConnectionManagerReconnect() {
	//reconnect() {
		this.initPools();
	//}
}
