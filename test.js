//
// test module
//
const config = require('./config.postgresql.template.js');
const db = require('./postgresql.js')(config);


async function main() {

    // await testSimpleSearchDoc();
    // await testSimpleSearchByColumn();
    // await testSaveDoc();
    await testSaveObject();
}


function testSimpleSearchDoc(){

    const docKeys = { pmi_code : 'A10.345'}

    db.findByDocKeys(docKeys, 'JSON_TABLE')
        .then( result => {
        console.log( result );
        /*
                result.forEach(v => {
                    console.log(v)
                })
                */
    } )
}

function testSimpleSearchByColumn(){

    const filter = { ROLESASSTRING : 'Operator'}
    db.findByColumns(filter, 'table_test')
        .then( result => {
            console.log( result );
        } )
}

function testSaveDoc(){

    const newdoc = { name : "Manolo el gafotas", urgent: false, number : 555 }
    const doc = { name : "Manolo el gafotas", urgent: false , number: 323}

    db.saveDocument(newdoc, 'JSON_TABLE', doc);

}

function testSaveObject(){

    db.save({ DISABLED : true }, 'table_test', { ROLESASSTRING : 'Operator' })
}

main();  // execute the test
