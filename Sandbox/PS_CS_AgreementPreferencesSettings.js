/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
 define(['N/log', 'N/search'],
 function(log, search) {
    function pageInit(context) {
        try{
            debugger;
            var currentRecord = context.currentRecord;
            var agreementTransaction = currentRecord.getValue("custrecord_ps_ap_agreement_creation_tran");
            var agreementTranLookup = currentRecord.getValue("custrecord_ps_ap_agreement_creation_look");
            debugger;
            if(agreementTransaction && !agreementTranLookup){
                var lookResults = search.lookupFields({
                    type: 'customrecord_ps_agreement_tran_type',
                    id: agreementTransaction,
                    columns: ['custrecord_ps_att_transaction']
                });
                log.error({title: "Agreement creation transaction type lookup", details: lookResults});
                if(lookResults){
                    if(lookResults.custrecord_ps_att_transaction && lookResults.custrecord_ps_att_transaction.length > 0){
                        currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : lookResults.custrecord_ps_att_transaction[0].value});
                    }
                    else{
                        currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : ""});
                    }
                }
                else{
                    currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : ""});
                }
            }
        }
        catch(error){
            log.error({title: "Error on page load", details: error});
        }
    }
    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldName = context.fieldId;
        if(fieldName == "custrecord_ps_ap_agreement_creation_tran"){
            var agreementTransaction = currentRecord.getValue("custrecord_ps_ap_agreement_creation_tran");
            if(agreementTransaction){
                var lookResults = search.lookupFields({
                    type: 'customrecord_ps_agreement_tran_type',
                    id: agreementTransaction,
                    columns: ['custrecord_ps_att_transaction']
                });
                log.error({title: "Agreement creation transaction type lookup", details: lookResults});
                if(lookResults){
                    if(lookResults.custrecord_ps_att_transaction && lookResults.custrecord_ps_att_transaction.length > 0){
                        currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : lookResults.custrecord_ps_att_transaction[0].value});
                    }
                    else{
                        currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : ""});
                    }
                }
                else{
                    currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : ""});
                }
            }
            else{
                currentRecord.setValue({ fieldId : "custrecord_ps_ap_agreement_creation_look", value : ""});
            }
        }
    }

    return {
        pageInit : pageInit,
        fieldChanged : fieldChanged
    };
 });