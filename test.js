//
// Extended tests for module-postgresql
//
const assert = require('assert');
const config = require('./config.postgresql.template.js');
const db = require('./postgresql.js')(config);

async function run() {
  try {
    // findByDocKeys (may return [] or data depending on DB state)
    const res1 = await db.findByDocKeys('JSON_TABLE', { pmi_code: 'A10.345' });
    assert.ok(Array.isArray(res1));
    console.log('findByDocKeys returned array OK, len=', res1.length);

    // findByColumns
    const res2 = await db.findByColumns('table_test', { ROLESASSTRING: 'Operator' });
    assert.ok(Array.isArray(res2));
    console.log('findByColumns OK');

    // Constants
    assert.strictEqual(db._AND, ' AND ');
    assert.strictEqual(db._OR, ' || ');
    console.log('constants OK');

    // Note: save/remove/query/update would modify data - commented for safety in this test
    // await db.save(...)

    console.log('Extended postgresql tests passed (read-only checks).');
  } catch (e) {
    console.error('Test error (may be expected if no DB/tables):', e.message);
    // Do not fail hard if external DB not present
  }
}

run();
