# module-postgresql

PostgreSQL database connector focused on simplifying the access to Document Storages as JSON fields.

#### configuration

saved for example as 'config.postgresql.js' 

```js
module.exports = {
  // CERTIFICATION_PATH : '/opt/<project>/Certificate',

  // RDS_CLOUD_CONNECTION : {
  //   ACCESS_KEY_ID : '<YOUR-ACCESS-KEY>',
  //   SECRET_ACCESS_KEY : '<YOUR-SECRET-ACCESS-KEY>',
  //   REGION : 'eu-west-1'
  // },

  POSTGRE_URL: '127.0.0.1',
  POSTGRE_PORT: 5432,
  POSTGRE_USER: 'root',
  POSTGRE_PASSWORD: 'root', // Only needed if it's not RDS based
  POSTGRE_DATABASE: 'test',
  TRACES: true
};
```

#### usage

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);
```

#### methods

##### findByDocKeys(tableName, where [, docName, conditions ])

Returns documents from the JSON column matching the where inside the doc.

- **Params**: tableName (str), where (obj), docName (default 'document'), conditions (default ' || ' or use db._AND / db._OR)
- **Returns**: Promise<array of docs>
- **Injection protection**: Yes (on table/doc/conditions)

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const where = { pmi_code: 'A10.345' };

db.findByDocKeys('JSON_TABLE', where)
  .then(results => {
    console.log(results);
  })
  .catch(err => console.error('Error:', err));
```

##### findAllFieldsByDocKeys(tableName, where [, docName, conditions ])

Like above but returns full row (not just the document column).

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const where = { pmi_code: 'A10.345' };

db.findAllFieldsByDocKeys('JSON_TABLE', where)
  .then(results => console.log(results))
  .catch(err => console.error(err));
```

##### findByColumns(tableName, where [, conditions ])

Search by top-level columns (not inside JSON doc).

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const filter = { ROLESASSTRING: 'Operator' };

db.findByColumns('table_test', filter)
  .then(results => console.log(results))
  .catch(err => console.error(err));
```

##### saveDocument(document, tableName, where[, docName])

Insert or update a full document JSON (uses PL/pgSQL DO block for upsert).

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const newdoc = { name: 'Manolo el gafotas', urgent: false, number: 555 };
const where = { name: 'Manolo el gafotas' };

db.saveDocument(newdoc, 'JSON_TABLE', where)
  .then(success => console.log('Saved:', success))
  .catch(err => console.error(err));
```

##### save(values, tableName [, where])

Column-based insert/upsert.

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const values = { DISABLED: true };
const where = { ROLESASSTRING: 'Operator' };

db.save(values, 'table_test', where)
  .then(success => console.log('Saved:', success))
  .catch(err => console.error(err));
```

##### remove(tableName, where, docName)

Delete. Careful: partial where can delete many rows.

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const where = { name: 'Manolo el gafotas' };

db.remove('JSON_TABLE', where, 'document')
  .then(success => console.log('Removed:', success))
  .catch(err => console.error(err));
```

##### query(sql, params)

Raw query with basic injection guard on the sql text.

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const sql = 'SELECT * FROM "JSON_TABLE" WHERE "document"->>\'pmi_code\' = $1';
const params = ['A10.345'];

db.query(sql, params)
  .then(results => console.log(results))
  .catch(err => console.error(err));
```

##### update(sql, params)

Raw update (no guard).

**Example (with minimal setup):**

```js
const config = require('./config.postgresql.js');
const db = require('@acastellon/postgresql')(config);

const sql = 'UPDATE "table_test" SET "status" = $1 WHERE id = $2';
const params = ['active', 42];

db.update(sql, params)
  .then(results => console.log(results))
  .catch(err => console.error(err));
```

**Constants**: db._AND, db._OR (use when building conditions manually).

See source for full escaping / where building logic.

## License

MIT
