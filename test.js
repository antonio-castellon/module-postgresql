//
// test module
//
const config = require('./config.postgresql.template.js');
const db = require('./postgresql.js')(config);


async function main() {

    await testSimpleSearchDoc();

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

main();  // execute the test
