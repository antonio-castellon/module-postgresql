"use strict";
//
// PostgreSQL connector manager.
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
    model.findByColumns = findByColumns;
    model.saveDocument = saveDocument;
    model.save = save;

    //
    //  FUNCTION BODY
    //

    function findByDocKeys(values, tableName, docName = "document",conditions = " || "){

            return new Promise(function(resolve, reject){

                if (utils.isAnySQLInjection(tableName)
                    || utils.isAnySQLInjection(docName)
                    || utils.isAnySQLInjection(conditions)) reject('sql injection detected');

                let where = "";
                let aux = "";

                Object.keys(values).forEach(function(key) {

                    // to substitute by regular expression toa void correct values
                    // if (utils.isAnySQLInjection(parameters[key])) reject('sql injection detected');

                    where = where + aux + 'jt."' + docName +'"->>\'' + key + '\'=\'' + values[key] + '\'';
                    aux = conditions;
                })

                if (where.length > 0) { where = ' WHERE ' + where; };

                const query = {
                    text: 'SELECT jt.* FROM \"' + tableName + '\" as jt ' + where ,
                    values: []
                }

                if (setup.TRACES) console.log(query);

                db
                    .query(query)
                    .then(res => resolve(res.rows))
                    .catch(err =>
                        setImmediate(() => {
                            console.log(err);
                            reject(err);
                        })
                    )
        });
    }

    function findByColumns(values, tableName, conditions = " || ") {

        return new Promise(function(resolve, reject){

            if (utils.isAnySQLInjection(tableName)
                || utils.isAnySQLInjection(conditions)) reject('sql injection detected');

            let where = "";
            let aux = "";

            Object.keys(values).forEach(function(key) {

                // to substitute by regular expression toa void correct values
                // if (utils.isAnySQLInjection(parameters[key])) reject('sql injection detected');

                where = where + aux + 'jt."' + key + '"=\'' + values[key] + '\'';
                aux = conditions;
            })

            if (where.length > 0) { where = ' WHERE ' + where; };

            const query = {
                text: 'SELECT jt.* FROM \"' + tableName + '\" as jt ' + where ,
                values: []
            }

            if (setup.TRACES) console.log(query);

            db
                .query(query)
                .then(res => resolve(res.rows))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });
    }

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
                .replace(/#{where}/g, ' WHERE ' + strWhere)
                .replace(/#{document}/g, JSON.stringify(document))
            ;


            const query = {
                text: cmdQuery ,
                values: []
            }

            if (setup.TRACES) console.log(query);

            db
                .query(query)
                .then(res => resolve(res.rows))
                .catch(err =>
                    setImmediate(() => {
                        console.log(err);
                        reject(err);
                    })
                )
        });
    }

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
                                .replace(/#{where}/g, ' WHERE ' + strWhere)
                                .replace(/#{colNames}/g, Object.keys(values))
                                .replace(/#{values}/g, Object.values(values))
                                .replace(/#{pairAssignations}/g, getPairs(values))
            ;


            const query = {
                text: cmdQuery ,
                values: []
            }

            if (setup.TRACES) console.log(query);

            db
                .query(query)
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

    function getWhere(values, docName){
        let strWhere = "";
        let _aux = "";
        let _prefixDoc = "";
        let _escape = '\'';

        if (utils.isNotNull(docName)) _prefixDoc = '"' + docName +'"->>';
        else _escape = '\"';

        Object.keys(values).forEach(function(key) {
            strWhere = strWhere + _aux + _prefixDoc + _escape + key + _escape + '=\'' + values[key] + '\'';
            _aux = ' AND ';
        })

        return strWhere;
    }

    return model;
}
