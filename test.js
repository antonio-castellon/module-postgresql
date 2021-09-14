//
// test module
//
const config = require('./config.postgresql.template.js');
const db = require('./postgresql.js')(config);


async function main() {

    await testSimpleSearchDoc();
    await testSimpleSearchByColumn();
    await testSaveDoc();
    await testSaveObject();
   // await testSaveObject2();
    await testDelete();
    await testDelete2();
}


function testSimpleSearchDoc(){

    const docKeys = { pmi_code : 'A10.345'}

    db.findByDocKeys('JSON_TABLE', docKeys)
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
    db.findByColumns('table_test', filter)
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

function testSaveObject2(){

    db.save({"batch": "XXX.344", "status": "DDDD", "location": "XXXX", }, 'table_test' , { id: 2 });
}

function testDelete(){
    const newdoc = { name : "Manolo el gafotas", urgent: false, number : 555 }
    db.remove('JSON_TABLE', newdoc, "document");
}

function testDelete2(){

    db.remove('table_test_1', {ROLESASSTRING : 'Operator' } );
}

main();  // execute the test
