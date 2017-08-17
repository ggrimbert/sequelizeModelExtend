const Model = require('sequelize/lib/model');
const _ = require('lodash');
 
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
/**
 * Execute a query on the DB, with the possibility to bypass all the sequelize goodness.
 *
 * By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc. Use `.spread` to access the results.
 *
 * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:
 *
 * ```js
 * sequelize.query('SELECT...').spread((results, metadata) => {
 *   // Raw query - use spread
 * });
 *
 * sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }).then(results => {
 *   // SELECT query - use then
 * })
 * ```
 *
 * @method query
 * @param {String}          sql
 * @param {Object}          [options={}] Query options.
 * @param {Boolean}         [options.raw] If true, sequelize will not try to format the results of the query, or build an instance of a model from the result
 * @param {Transaction}     [options.transaction=null] The transaction that the query should be executed under
 * @param {QueryTypes}      [options.type='RAW'] The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
 * @param {Boolean}         [options.nest=false] If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified
 * @param {Boolean}         [options.plain=false] Sets the query type to `SELECT` and return a single row
 * @param {Object|Array}    [options.replacements] Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL.
 * @param {Object|Array}    [options.bind] Either an object of named bind parameter in the format `_param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL.
 * @param {Boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
 * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
 * @param {new Model()}       [options.instance] A sequelize instance used to build the return instance
 * @param {Model}           [options.model] A sequelize model used to build the returned model instances (used to be called callee)
 * @param {Object}          [options.retry] Set of flags that control when a query is automatically retried.
 * @param {Array}           [options.retry.match] Only retry a query if the error matches one of these strings.
 * @param {Integer}         [options.retry.max] How many times a failing query is automatically retried.
 * @param {String}          [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
 * @param {Boolean}         [options.supportsSearchPath] If false do not prepend the query with the search_path (Postgres only)
 * @param {Boolean}          [options.mapToModel=false] Map returned fields to model's fields if `options.model` or `options.instance` is present. Mapping will occur before building the model instance.
 * @param {Object}          [options.fieldMap] Map returned fields to arbitrary names for `SELECT` query type.
 *
 * @return {Promise}
 *
 * @see {@link Model.build} for more information about instance option.
 */

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