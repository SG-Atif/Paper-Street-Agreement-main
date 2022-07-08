/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/search', 'N/record',], function(log, search, record) {
    function beforeSubmit(context) {
        if (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) {
            try{
                log.debug({ title: "Current Context", details : context.type });
                var currentRecId = context.newRecord.id;
                log.debug({ title: "Record Id", details: currentRecId });
                if(currentRecId){
                    var transactionType = context.newRecord.getText({
                        fieldId: 'custrecord_ps_att_transaction',  
                    });
                    if(transactionType){
                        context.newRecord.setValue({
                            fieldId: 'name',  
                            value: transactionType
                        });
                    }
                }
            }
            catch(error){
                log.error({ title : "Error on after submit", details : JSON.stringify(error) });
            }
        }
    }
    
    return {
        beforeSubmit: beforeSubmit
    }
});