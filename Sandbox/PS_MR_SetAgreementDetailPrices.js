/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

 define(['N/log', 'N/search', 'N/record'], 
function(log, search, record) {
    function getInputData() {
        var agreementDetailSearch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_price_level","noneof","@NONE@"], 
               "AND", 
               ["custrecord_ps_aad_rate","isempty",""], 
               "AND", 
               ["custrecord_ps_aad_quantity","isnotempty","0"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_item", label: "Item"})
            ]
         });
        return agreementDetailSearch;
    }

    function map(context) {
        try{
            if(context.value){
                var searchResult = JSON.parse(context.value);
                log.debug({title : "Data", details : searchResult});
                if(searchResult){
                    if(searchResult.id){
                        var currentAgreementDetailRec =  record.load({
                            type: "customrecord_ps_agreement_details",
                            id: searchResult.id,
                            isDynamic: false,
                        });
                        currentAgreementDetailRec.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                    }
                }
            }
        }
        catch(exp){
            log.error({ title : "Error In Map Function", details : JSON.stringify(exp)});
        }
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});