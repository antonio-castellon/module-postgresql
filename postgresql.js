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

const { Pool, Client } = require('pg')
const { RDS } = require('aws-sdk')
const utils = require('@acastellon/module-utils');

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

    //
    //  FUNCTION BODY
    //

    function findByDocKeys(parameters, collectionName, conditions = " || "){

            return new Promise(function(resolve, reject){

                if (utils.isAnySQLInjection(collectionName)) reject('sql injection detected');
                if (setup.TRACES) console.log(parameters);

                let where = "";
                let aux = "";

                Object.keys(parameters).forEach(function(key) {
                    where = where + aux + 'jt."document"->>\'' + key + '\'=\'' + parameters[key] + '\'';
                    aux = conditions;
                })

                if (where.length > 0) { where = ' WHERE ' + where; };

                const query = {
                    text: 'SELECT jt.* FROM \"' + collectionName + '\" as jt ' + where ,
                    values: []
                }

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



    return model;
}
