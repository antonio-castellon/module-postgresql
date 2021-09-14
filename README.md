# module-postgresql
Postgresql database connector focus on simplify the access to Document Storages as JSON fields

#### configuration

saved for example as 'config.postgresql.js' 

    module.exports = {
    
         ,CERTIFICATION_PATH : '/opt/<project>/Certificate'
    
         ,RDS_CLOUD_CONNECTION : {
             , ACCESS_KEY_ID : <YOUR-ACCESS-KEY>
             , SECRET_ACCESS_KEY : <YOUR-SECRET-ACCESS-KEY>
             , REGION : 'eu-west-1',
         }
    
        , POSTGRE_URL: '127.0.0.1' | '....eu-west-1.rds.amazonaws.com'
         , POSTGRE_PORT : 5432
        , POSTGRE_USER: 'root'
        , POSTGRE_PASSWORD: 'root' // Only needed if it's not RDS based
        , POSTGRE_DATABASE: 'test'
    
        , TRACES : true
    }

#### usage:

    const config = require('./config.postgresql.js');
    const db = require('@acastellon/module-postgresql')(config);

#### methods

##### Returns all values from a Table searching by an internal document values.

    findByDocKeys(tableName, where [, docName, conditions ])

        * @param tableName - Name of the table in Postgre to look inside
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param docName - name of the column on table that contains the JSON data, by default: 'document'
        * @param conditions - conditions for all where values on the select , by default: ' || ', use _AND or _OR constants from db instance
        * @return an object or List of results as JSON objects

##### Returns All data from a table based on column values

    findByColumns(tableName, where [, conditions ])
        * @param tableName - Name of the table in Postgre to look inside
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param conditions - conditions for all where values on the select , by default: ' || ' , use _AND or _OR constants from db instance
        * @return an object or List of results as JSON objects

##### Insert or Update values from a JSON-document based on document matching. 
##### It means, all documents that has the same conditions on the table referenced will be changed for the new JSON document value. 

    saveDocument(document, tableName, where[, docName])
        * @param document - document to be saved
        * @param tableName - Name of the table 
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param docName - name of the column on table that contains the JSON data, by default: 'document'
        * @return - true if te operation was sucessfully done

##### Insert or Update values from a Table

    save(values, tableName [, where])
        * @param values - to update or to be saved
        * @param tableName - Name of the table
        * @param where - JSON object that contains the parameters to use in the filter search, by default = {}
        * @return - true if te operation was sucessfully done

##### Delete value on table 

    remove(tableName, where, docName)
        * @param tableName - Name of the table
        * @param where - JSON object that contains the parameters to use in the filter
        * @param docName - name of the column on table that contains the JSON data, if it's NULL means to search by column values on table not inside the document.
        * @return - true if te operation was sucessfully done

##### Execute an SQL sentence directly
Use it carefully, only in case that a complex SQL sentence is needed.

    execute(sql, params)
        * @param sql - SQL sentence to be executed
        * @param params - parameters to use in the SQL sentence ($1, $2, etc) as an Array of values or Objects.
        * @return an object or List of results as JSON objects
