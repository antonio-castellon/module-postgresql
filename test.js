//
// test module
//
const config = require('./config.postgresql.template.js');
const db = require('./postgresql.js')(config);

async function main() {
  try {
    await testSimpleSearchDoc();
    await testSimpleSearchByColumn();
    // await testSaveDoc();
    // await testSaveObject();
    // await testDelete();
  } catch (e) { console.error(e); }
}

function testSimpleSearchDoc() {
  const docKeys = { pmi_code: 'A10.345' };
  return db.findByDocKeys('JSON_TABLE', docKeys).then(console.log);
}

function testSimpleSearchByColumn() {
  const filter = { ROLESASSTRING: 'Operator' };
  return db.findByColumns('table_test', filter).then(console.log);
}

main();
