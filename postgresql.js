"use strict";
//
// PostgreSQL connector manager specialized on JSON objects.
//
// Castellon.CH (c)
// Author: Antonio Castellon - antonio@castellon.ch
//
// config parameter:
//
// module.exports = {
//
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
//

const { Pool, Client } = require('pg');
const { RDS } = require('aws-sdk');
const utils = require('@acastellon/utils')();

module.exports = function(setup) {

    const model = {};

    //
    // CONFIGURATION
    //

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
        }
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
        const getPassword = () => signer.getAuthToken(signerOptions)

        db.options.password = getPassword;
    }
    else {
        db.options.password = setup.POSTGRE_PASSWORD;
    }


    db.connect()
        .then(client => {
            console.log('postgresql connection successful')
            client.release()
        })
        .catch(err => console.error('error connecting to postgrsql', err.stack));


    //
    // ASSIGNATIONS
    //

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

    //
    //  FUNCTION BODY ( PUBLIC )
    //

    /**
     * Direct SQL query to the database - DROP, DELETE, INSERT, UPDATE are not allowed
     * @param sql - SQL command sentence
     * @param params - parameters if are needed in the sentence using ($1, $2 ... ) as a reference in the query.
     * @returns {*}
     */
    function query(sql, params){

        if (utils.isAnySQLInjection(sql)) reject('sql injection detected');

        const query = {
            text: sql ,
            values: params
        }

        if (setup.TRACES) console.log(query);

        return db.query(query)
    }

    /**
     * Additional method to update fields on table, be careful using it because it has no control about the
     * sql sentence executed
     *
     * @param sql
     * @param params
     * @returns {*}
     */
    function update(sql, params) {

        const query = {
            text: sql ,
            values: params
        }
        return db.query(query)

    }

    /**
     * Retrieve all JSON Document objects that match with the condition inside the document data schema
     *
     * @param tableName - name of the table that contains the documents
     * @param where - pair key-values that represents the condition to look inside the documents
     * @param docName - name of the field on the table that refers to the dcouments (tip, a table could contain several columns with several documents aligned)
     * @param conditions - to stablish if the conditions are restrictive or not ( AND , OR ) for the where clausule.
     * @returns {Promise<unknown>}
     */
    function findByDocKeys(tableName, where, docName = "document",conditions = " || ") {
        return find(where, tableName, docName, conditions);
    }

    function findAllFieldsByDocKeys(tableName, where, docName = "document",conditions = " || ") {
        return find(where, tableName, docName, conditions, true);
    }

    function findByColumns(tableName, where, conditions = " || ") {
        return find(where, tableName, null, conditions);
    }

    /**
     * Save a JSON Document Object inside a table, to be used when a table has no column with an ID to identify each
     * document as unique, and instead to use another external column as PK, it uses property(es) from inside the documents
     *
     * @param document - new value of the document to be stored
     * @param tableName - name of the table
     * @param where - comndition to match for all documents
     * @param docName - name of the column name that contains the document
     * @returns {Promise<[JSON Objects]>}
     */
    function saveDocument(document, tableName, where, docName = "document"){

        return new Promise(function(resolve, reject){

            if (utils.isAnySQLInjection(tableName)) reject('sql injection detected');

            let cmdQuery = 'INSERT INTO "#{tableName}" ("#{docName}") VALUES (\'#{document}\') ';

            let strWhere = getWhere(where, docName);

            if (strWhere.length > 0)
            {
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
                .replace(/#{document}/g, JSON.stringify(document))
            ;

            _execute(cmdQuery, [])
                .then(res => resolve(true))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });
    }

    /**
     * Save column values inside a declared table. It can be used to update only some fields of the table.
     *
     * @param values - pair key-value that represents: column_name : value_to_update_insert
     * @param tableName - name of the table to store all data
     * @param where - condition in order to update the row, if foesnt match the function will insert a new data
     * @returns {Promise<true|error>}
     */
    function save(values, tableName, where = {}){

        return new Promise(function(resolve, reject) {

            if (utils.isAnySQLInjection(tableName))  reject('sql injection detected');

            let cmdQuery = 'INSERT INTO "#{tableName}" (#{colNames}) VALUES (#{values}) ';
            let strWhere = getWhere(where);
            if (strWhere.length > 0)
            {
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
                .replace(/#{pairAssignations}/g, getPairs(values))
            ;


            _execute(cmdQuery, [])
                .then(res => resolve(true))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });

    }

    /**
     * delete row data from a table
     *
     * @param tableName - name of the table
     * @param where - condition to match as a pair key-value object
     * @param docName - in case that the condition is based on properties inside a JSON Document, the name of the column that contains this document
     * @returns {Promise<true|error>}
     */
    function remove(tableName, where, docName){

        return new Promise(function(resolve, reject) {

            if (utils.isAnySQLInjection(tableName)) reject('sql injection detected');
            if (utils.isEmpty(where)) reject('missing filter (where) to identify items to be deleted');

            const strWhere = getWhere(where, docName);

            if (strWhere.length > 0)
            {
                let cmdQuery = 'DELETE FROM \"' + tableName + '\" ' + strWhere;

                _execute(cmdQuery, [])
                    .then(res => resolve(true))
                    .catch(err =>
                        setImmediate(() => {
                            console.log(err);
                            reject(err);
                        })
                    )
            }
            else reject(false);

        });
    }


    //
    // PRIVATE FUNCTIONS
    //

    function _execute(sql, params ){
        const query = {
            text: sql ,
            values: params
        }

        if (setup.TRACES) console.log(query);

        return db.query(query)

    }

    function find(values, tableName, docName, conditions, fullSchema = false){

        return new Promise(function(resolve, reject){

            if (utils.isAnySQLInjection(tableName)
                || utils.isAnySQLInjection('' + docName)
                || utils.isAnySQLInjection('' + conditions)) reject('sql injection detected');

            let where = getWhere(values,docName, conditions);
            let wildcard = "*";

            if (utils.isNotNull(docName) && !fullSchema) {  wildcard = '\"' + docName + '\"'; }

            const cmdQuery = 'SELECT jt.' + wildcard + ' FROM \"' + tableName + '\" as jt ' + where;

            _execute(cmdQuery, [])
                .then(res => resolve(res.rows))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });
    }

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

    function getPairs(values){

        let _aux = "";
        let _pairs = "";

        Object.keys(values).forEach(function(key) {
            _pairs =  _pairs + _aux + '\"' + key +'\" = ' + Escape(values[key]);
            _aux = " , "
        });

        return _pairs;
    }

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
                   })

                   strWhere = strWhere + ")";
                   _aux = conditions;
               }
               else {
                   strWhere = strWhere + _aux + _prefixDoc + _escape + key + _escape + '=\'' + values[key] + '\'';
                   _aux = conditions;
               }
            }
        })

        if (strWhere.length > 0) strWhere = ' WHERE ' + strWhere;

        return strWhere;
    }

    function getValues(values){

        const all = values.map(el => {
            return Escape(el)
        })

        return all.join(',');
    }

    return model;
}
