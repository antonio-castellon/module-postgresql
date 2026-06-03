"use strict";
//
// PostgreSQL connector manager specialized on JSON objects.
//
// Castellon.CH - 2019-2026 (c)
// Author: Antonio Castellon - antonio@castellon.ch
//
// config parameter:
//
// module.exports = {
//      ,CERTIFICATION_PATH : '/opt/<project>/Certificate'
//
//      ,RDS_CLOUD_CONNECTION : {
//          , ACCESS_KEY_ID : <YOUR-ACCESS-KEY>
//          , SECRET_ACCESS_KEY : <YOUR-SECRET-ACCESS-KEY>
//          , REGION : 'eu-west-1',
//      }
//
//  	, POSTGRE_URL: '127.0.0.1' | '....eu-west-1.rds.amazonaws.com'
//      , POSTGRE_PORT : 5432
//  	, POSTGRE_USER: 'root'
//  	, POSTGRE_PASSWORD: 'root' // Only needed if it's not RDS based
//  	, POSTGRE_DATABASE: 'test'
//
//  	, TRACES : true
// }
//
//

const { Pool } = require('pg');
const { RDS } = require('aws-sdk');
const fs = require('fs');
const utils = require('@acastellon/utils')();

/**
 * PostgreSQL document/JSON store helper factory.
 *
 * Provides methods for storing and querying JSON documents in PostgreSQL tables
 * (using a dedicated JSON column for the document + optional top-level columns).
 * Includes basic SQL injection guards on table/column names and dynamic parts.
 *
 * Supports both RDS (IAM auth) and standard password connections, plus optional TLS certs.
 *
 * @param {object} setup - Configuration object
 * @param {string} setup.POSTGRE_URL
 * @param {number} setup.POSTGRE_PORT
 * @param {string} setup.POSTGRE_DATABASE
 * @param {string} setup.POSTGRE_USER
 * @param {string} [setup.POSTGRE_PASSWORD] - Not needed for RDS_CLOUD_CONNECTION
 * @param {string} [setup.CERTIFICATION_PATH] - Path to TLS certs (root.crt, postgresql.key, postgresql.crt)
 * @param {object} [setup.RDS_CLOUD_CONNECTION] - For AWS RDS IAM auth
 * @param {string} setup.RDS_CLOUD_CONNECTION.ACCESS_KEY_ID
 * @param {string} setup.RDS_CLOUD_CONNECTION.SECRET_ACCESS_KEY
 * @param {string} setup.RDS_CLOUD_CONNECTION.REGION
 * @param {boolean} [setup.TRACES=false]
 * @returns {object} model with the documented methods + _AND / _OR constants
 */
module.exports = function(setup) {

    const model = {};

    const db = new Pool({
        host: setup.POSTGRE_URL,
        port: setup.POSTGRE_PORT,
        database: setup.POSTGRE_DATABASE,
        user: setup.POSTGRE_USER,
    });

    if (setup.CERTIFICATION_PATH){
        db.ssl = {
            rejectUnauthorized: false,
            ca: fs.readFileSync(setup.CERTIFICATION_PATH + '/root.crt').toString(),
            key: fs.readFileSync(setup.CERTIFICATION_PATH + '/postgresql.key').toString(),
            cert: fs.readFileSync(setup.CERTIFICATION_PATH + '/postgresql.crt').toString()
        };
    }

    if (setup.RDS_CLOUD_CONNECTION) {
        const signerOptions = {
            credentials: {
                accessKeyId: setup.RDS_CLOUD_CONNECTION.ACCESS_KEY_ID,
                secretAccessKey: setup.RDS_CLOUD_CONNECTION.SECRET_ACCESS_KEY
            },
            region: setup.RDS_CLOUD_CONNECTION.REGION,
            hostname: setup.POSTGRE_URL,
            port:  setup.POSTGRE_PORT,
            username:  setup.POSTGRE_USER
        };

        const signer = new RDS.Signer();
        const getPassword = () => signer.getAuthToken(signerOptions);

        db.options.password = getPassword;
    }
    else {
        db.options.password = setup.POSTGRE_PASSWORD;
    }

    db.connect()
        .then(client => {
            console.log('postgresql connection successful');
            client.release();
        })
        .catch(err => console.error('error connecting to postgresql', err.stack));

    model.findByDocKeys = findByDocKeys;
    model.findAllFieldsByDocKeys = findAllFieldsByDocKeys;
    model.findByColumns = findByColumns;
    model.saveDocument = saveDocument;
    model.save = save;
    model.remove = remove;
    model.query = query;
    model.update = update;
    model._AND = ' AND ';
    model._OR = ' || ';

    /**
     * Direct SQL query (with basic injection protection on the sql string itself).
     *
     * @param {string} sql
     * @param {any[]} [params]
     * @returns {Promise<import('pg').QueryResult>}
     */
    function query(sql, params){
        if (utils.isAnySQLInjection(sql)) {
            return Promise.reject(new Error('sql injection detected'));
        }

        const q = { text: sql, values: params };
        if (setup.TRACES) console.log(q);
        return db.query(q);
    }

    /**
     * Raw update (no injection protection on the SQL).
     * Use with trusted static SQL + parameters.
     *
     * @param {string} sql
     * @param {any[]} [params]
     * @returns {Promise<import('pg').QueryResult>}
     */
    function update(sql, params) {
        const q = { text: sql, values: params };
        return db.query(q);
    }

    /**
     * Find documents by matching inside the JSON document column (byExample style).
     *
     * @param {string} tableName
     * @param {object} where
     * @param {string} [docName='document']
     * @param {string} [conditions=' || ']
     * @returns {Promise<Array>}
     */
    function findByDocKeys(tableName, where, docName = "document", conditions = " || ") {
        return find(where, tableName, docName, conditions);
    }

    /**
     * Like findByDocKeys but returns the full row (all columns), not just the document.
     *
     * @param {string} tableName
     * @param {object} where
     * @param {string} [docName='document']
     * @param {string} [conditions=' || ']
     * @returns {Promise<Array>}
     */
    function findAllFieldsByDocKeys(tableName, where, docName = "document", conditions = " || ") {
        return find(where, tableName, docName, conditions, true);
    }

    /**
     * Find by top-level columns (outside the JSON document).
     *
     * @param {string} tableName
     * @param {object} where
     * @param {string} [conditions=' || ']
     * @returns {Promise<Array>}
     */
    function findByColumns(tableName, where, conditions = " || ") {
        return find(where, tableName, null, conditions);
    }

    /**
     * Upsert a full document into the JSON column (uses PL/pgSQL DO block for upsert).
     *
     * @param {object} document - the JSON document to store
     * @param {string} tableName
     * @param {object} where - used to decide insert vs update
     * @param {string} [docName='document']
     * @returns {Promise<boolean>}
     */
    function saveDocument(document, tableName, where, docName = "document"){
        return new Promise((resolve, reject) => {
            if (utils.isAnySQLInjection(tableName)) {
                reject(new Error('sql injection detected'));
                return;
            }

            let cmdQuery = 'INSERT INTO "#{tableName}" ("#{docName}") VALUES (\'#{document}\') ';

            let strWhere = getWhere(where, docName);

            if (strWhere.length > 0) {
                cmdQuery =
                    'DO $$ BEGIN ' +
                    ' IF EXISTS ( SELECT * FROM "#{tableName}" #{where} )' +
                    ' THEN ' +
                    ' UPDATE "#{tableName}" SET "#{docName}" = \'#{document}\' #{where}; ' +
                    ' ELSE ' +
                    ' INSERT INTO "#{tableName}" ("#{docName}") VALUES (\'#{document}\'); ' +
                    ' END IF; ' +
                    'END $$;';
            }

            cmdQuery = cmdQuery.replace(/#{tableName}/g, tableName)
                .replace(/#{docName}/g, docName)
                .replace(/#{where}/g, strWhere)
                .replace(/#{document}/g, JSON.stringify(document));

            _execute(cmdQuery, [])
                .then(() => resolve(true))
                .catch(err => setImmediate(() => { console.log(err); reject(err); }));
        });
    }

    /**
     * Column-based insert or upsert (by top-level columns).
     *
     * @param {object} values - column values
     * @param {string} tableName
     * @param {object} [where={}]
     * @returns {Promise<boolean>}
     */
    function save(values, tableName, where = {}){
        return new Promise((resolve, reject) => {
            if (utils.isAnySQLInjection(tableName)) {
                reject(new Error('sql injection detected'));
                return;
            }

            let cmdQuery = 'INSERT INTO "#{tableName}" (#{colNames}) VALUES (#{values}) ';
            let strWhere = getWhere(where);
            if (strWhere.length > 0) {
                cmdQuery =
                    'DO $$ BEGIN ' +
                    ' IF EXISTS ( SELECT * FROM "#{tableName}" #{where} )' +
                    ' THEN ' +
                    '   UPDATE "#{tableName}" SET #{pairAssignations} #{where}; ' +
                    ' ELSE ' +
                    '   INSERT INTO "#{tableName}" (#{colNames}) VALUES (#{values}); ' +
                    ' END IF; ' +
                    'END $$;';
            }

            cmdQuery = cmdQuery.replace(/#{tableName}/g, tableName)
                .replace(/#{where}/g, strWhere)
                .replace(/#{colNames}/g, Object.keys(values))
                .replace(/#{values}/g, getValues(Object.values(values)))
                .replace(/#{pairAssignations}/g, getPairs(values));

            _execute(cmdQuery, [])
                .then(() => resolve(true))
                .catch(err => setImmediate(() => { console.log(err); reject(err); }));
        });
    }

    /**
     * Delete rows matching the where clause.
     * Warning: incomplete where can delete many rows.
     *
     * @param {string} tableName
     * @param {object} where
     * @param {string} [docName]
     * @returns {Promise<boolean>}
     */
    function remove(tableName, where, docName){
        return new Promise((resolve, reject) => {
            if (utils.isAnySQLInjection(tableName)) {
                reject(new Error('sql injection detected'));
                return;
            }
            if (utils.isEmpty(where)) {
                reject(new Error('missing filter (where) to identify items to be deleted'));
                return;
            }

            const strWhere = getWhere(where, docName);

            if (strWhere.length > 0) {
                const cmdQuery = 'DELETE FROM "' + tableName + '" ' + strWhere;
                _execute(cmdQuery, [])
                    .then(() => resolve(true))
                    .catch(err => setImmediate(() => { console.log(err); reject(err); }));
            } else {
                reject(false);
            }
        });
    }

    /**
     * Internal query executor with optional tracing.
     * @private
     */
    function _execute(sql, params ){
        const q = { text: sql, values: params };
        if (setup.TRACES) console.log(q);
        return db.query(q);
    }

    /**
     * Internal find implementation.
     * @private
     */
    function find(values, tableName, docName, conditions, fullSchema = false){
        return new Promise((resolve, reject) => {
            if (utils.isAnySQLInjection(tableName)
                || utils.isAnySQLInjection('' + docName)
                || utils.isAnySQLInjection('' + conditions)) {
                reject(new Error('sql injection detected'));
                return;
            }

            const where = getWhere(values, docName, conditions);
            let wildcard = "*";

            if (utils.isNotNull(docName) && !fullSchema) { wildcard = '"' + docName + '"'; }

            const cmdQuery = 'SELECT jt.' + wildcard + ' FROM "' + tableName + '" as jt ' + where;

            _execute(cmdQuery, [])
                .then(res => resolve(res.rows))
                .catch(err => setImmediate(() => { console.log(err); reject(err); }));
        });
    }

    /**
     * Internal value escaping helper.
     * @private
     */
    function Escape(value){
        if (isNaN(value))
            if (utils.isAnObject(value))
                return '\'' + JSON.stringify(value) + '\'';
            else if (typeof value == 'boolean')
                return value;
            else
                return '\'' + value + '\'';
        else return value;
    }

    /**
     * Internal helper to build SET clause for updates.
     * @private
     */
    function getPairs(values){
        let _aux = "";
        let _pairs = "";
        Object.keys(values).forEach(function(key) {
            _pairs =  _pairs + _aux + '\"' + key +'\" = ' + Escape(values[key]);
            _aux = " , ";
        });
        return _pairs;
    }

    /**
     * Internal WHERE clause builder (supports arrays with OR, JSON paths, etc.).
     * @private
     */
    function getWhere(values, docName, conditions = " && "){
        let strWhere = "";
        let _aux = "";
        let _prefixDoc = "";
        let _escape = '\'';

        if (utils.isNotNull(docName)) _prefixDoc = '"' + docName +'"->>';
        else _escape = '\"';

        Object.keys(values).forEach(function(key) {
            if (utils.isNotUndefined(values[key])) {
               if(Array.isArray(values[key]))
               {
                   strWhere = strWhere + _aux + "(";
                   _aux = "";
                   values[key].forEach(function (value){
                       strWhere = strWhere + _aux +
                                        _prefixDoc + _escape + key + _escape + '=\'' + value + '\'';
                       _aux = " OR ";
                   });

                   strWhere = strWhere + ")";
                   _aux = conditions;
               }
               else {
                   strWhere = strWhere + _aux + _prefixDoc + _escape + key + _escape + '=\'' + values[key] + '\'';
                   _aux = conditions;
               }
            }
        });

        if (strWhere.length > 0) strWhere = ' WHERE ' + strWhere;

        return strWhere;
    }

    /**
     * Internal VALUES list builder.
     * @private
     */
    function getValues(values){
        const all = values.map(el => Escape(el));
        return all.join(',');
    }

    return model;
};