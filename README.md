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

##### findByDocKeys(tableName, where [, docName, conditions ])
Returns documents from the JSON column matching the where inside the doc.

- **Params**: tableName (str), where (obj), docName (default 'document'), conditions (default ' || ' or use db._AND / db._OR)
- **Returns**: Promise<array of docs>
- **Injection protection**: Yes (on table/doc/conditions)

##### findAllFieldsByDocKeys(...)
Like above but returns full row (not just the document column).

##### findByColumns(tableName, where [, conditions ])
Search by top-level columns (not inside JSON doc).

##### saveDocument(document, tableName, where[, docName])
Insert or update a full document JSON (uses PL/pgSQL DO block for upsert).

##### save(values, tableName [, where])
Column-based insert/upsert.

##### remove(tableName, where, docName)
Delete. Careful: partial where can delete many rows.

##### query(sql, params)
Raw query with basic injection guard on the sql text.

##### update(sql, params)
Raw update (no guard).

**Constants**: db._AND, db._OR

See source for full escaping / where building logic.

## License

MIT
