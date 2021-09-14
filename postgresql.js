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
    model.execute = execute;
    model._AND = ' AND ';
    model._OR = ' || ';

    //
    //  FUNCTION BODY ( PUBLIC )
    //

    function execute(sql,params ){
        const query = {
            text: sql ,
            values: params
        }

        if (setup.TRACES) console.log(query);

        return db.query(query)

    }

    function findByDocKeys(tableName, where, docName = "document",conditions = " || ") {
            return find(where, tableName, docName, conditions);
    }

    function findAllFieldsByDocKeys(tableName, where, docName = "document",conditions = " || ") {
        return find(where, tableName, docName, conditions, true);
    }

    function findByColumns(tableName, where, conditions = " || ") {
        return find(where, tableName, null, conditions);
    }

    // Insert or Update JSON-Document on a table that has a JSON column,
    // WHERE : based on the internal values from the JSON stored if exists
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

            execute(cmdQuery, [])
                .then(res => resolve(true))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });
    }

    // Insert or update values on a Relational Table
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
                                .replace(/#{values}/g, Object.values(values))
                                .replace(/#{pairAssignations}/g, getPairs(values))
            ;


            execute(cmdQuery, [])
                .then(res => resolve(true))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });

    }

    function remove(tableName, where, docName){

        return new Promise(function(resolve, reject) {

            if (utils.isAnySQLInjection(tableName)) reject('sql injection detected');
            if (utils.isEmpty(where)) reject('missing filter (where) to identify items to be deleted');

            const strWhere = getWhere(where, docName);

            if (strWhere.length > 0)
            {
                let cmdQuery = 'DELETE FROM \"' + tableName + '\" ' + strWhere;

                execute(cmdQuery, [])
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

    function find(values, tableName, docName, conditions, fullSchema = false){

        return new Promise(function(resolve, reject){

            if (utils.isAnySQLInjection(tableName)
                || utils.isAnySQLInjection('' + docName)
                || utils.isAnySQLInjection('' + conditions)) reject('sql injection detected');

            let where = getWhere(values,docName, conditions);
            let wildcard = "*";

            if (utils.isNotNull(docName) && !fullSchema) {  wildcard = '\"' + docName + '\"'; }

            const cmdQuery = 'SELECT jt.' + wildcard + ' FROM \"' + tableName + '\" as jt ' + where;

            execute(cmdQuery, [])
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

        if (isNaN(value)) return  '\"' + value + '\"'
        return value;
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
            strWhere = strWhere + _aux + _prefixDoc + _escape + key + _escape + '=\'' + values[key] + '\'';
            _aux = conditions;
        })

        if (strWhere.length > 0) strWhere = ' WHERE ' + strWhere;

        return strWhere;
    }

    return model;
}
