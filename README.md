# module-postgresql

PostgreSQL database connector focused on simplifying the access to Document Storages as JSON fields.

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
    const db = require('@acastellon/postgresql')(config);

#### methods

##### Returns all values from a Table searching by an internal document values.

    findByDocKeys(tableName, where [, docName, conditions ])

        * @param tableName - Name of the table in Postgre to look inside
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param docName - name of the column on table that contains the JSON data, by default: 'document'
        * @param conditions - conditions for all where values on the select , by default: ' || ', use _AND or _OR constants from db instance
        * @return an object or List of results as JSON objects

##### Return all values (including other columns) from a Table, looking for a matching on internal values of the document (where param)
    findAllFieldsByDocKeys(tableName, where [, docName, conditions ])

        * @param tableName - Name of the table in Postgre to look inside
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param docName - name of the column on table that contains the JSON data, by default: 'document'
        * @param conditions - conditions for all where values on the select , by default: ' || ', use _AND or _OR constants from db instance
        * @return an object or List of results as JSON objects with all collateral FIELDS (if exists) from the same table (not only the JSON document)

##### Returns All data from a table based on column values

    findByColumns(tableName, where [, conditions ])
        * @param tableName - Name of the table in Postgre to look inside
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param conditions - conditions for all where values on the select , by default: ' || ' , use _AND or _OR constants from db instance
        * @return an object or List of results as JSON objects

##### Insert or Update values from a JSON-document based on document matching. 

    saveDocument(document, tableName, where[, docName])
        * @param document - document to be saved 
        * @param tableName - Name of the table 
        * @param where - JSON object that contains the parameters to be found on the JSON Document
        * @param docName - name of the column on table that contains the JSON data, by default: 'document'
        * @return - true if the operation was successfully done

##### Save column values inside a declared table. It can be used to update only some fields of the table.

    save(values, tableName [, where])
        * @param values - to update or to be saved as a pair key-values on an Object
        * @param tableName - Name of the table
        * @param where - JSON object that contains the parameters to use in the filter search, by default = {}
        * @return - true if the operation was successfully done

##### Delete value on table 

    remove(tableName, where, docName)
        * @param tableName - Name of the table
        * @param where - JSON object that contains the parameters to use in the filter
        * @param docName - name of the column on table that contains the JSON data, if it's NULL means to search by column values on table not inside the document.
        * @return - true if the operation was successfully done

##### Execute an SQL sentence directly (no injection protection for complex queries)

    query(sql, params)
        * @param sql - SQL sentence to be executed
        * @param params - parameters to use in the SQL sentence ($1, $2, etc) as an Array of values.
        * @return Promise of results

    update(sql, params) - for direct updates without protection checks.
