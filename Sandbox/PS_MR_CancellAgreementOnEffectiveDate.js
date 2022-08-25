/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

 define(['N/log', 'N/search', 'N/record'], 
function(log, search, record) {
    function getInputData() {
        var conclusionSrch = search.create({
            type: "customrecord_ps_agreement_conculsion",
            filters:
            [
               ["custrecord_ps_ac_effective_date","on","today"], 
               //["internalid", "anyof", "317"],
               "AND", 
               ["custrecord_ps_ac_concluding_event","anyof","2"], 
               "AND", 
               ["custrecord_ps_as_agreement_detail.custrecord_ps_aad_status","noneof","3"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_as_agreement_detail", label: "Agreement Detail"}),
               search.createColumn({name: "custrecord_ps_ac_agreement", label: "Agreement"})
            ]
        });
        return conclusionSrch;
    }

    function map(context) {
        try{
            if(context.value){
                var searchResult = JSON.parse(context.value);
                log.debug({title : "Data", details : searchResult});
                if(searchResult){
                    if(searchResult.id){
                        var agreementId = searchResult.values.custrecord_ps_ac_agreement.value;
                        var agreementDetailId = searchResult.values.custrecord_ps_as_agreement_detail.value;
                        log.debug({title : "Current Rec Id | Agreement Id", details : searchResult.id +" | "+ agreementId});
                        var currentAgreementDetailRec =  record.load({
                            type: "customrecord_ps_agreement_details",
                            id: agreementDetailId,
                            isDynamic: false,
                        });
                        if(currentAgreementDetailRec){
                            currentAgreementDetailRec.setValue({
                                fieldId: 'custrecord_ps_aad_status',
                                value: "3",
                            });
                            currentAgreementDetailRec.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                            var isAllLinesCancelled = isAllAgreementDetailCancelled(agreementId);
                            if(isAllLinesCancelled == true){
                                var currentAgreementRec =  record.load({
                                    type: "customrecord_ps_agreement",
                                    id: agreementId,
                                    isDynamic: false,
                                });
                                if(currentAgreementRec){
                                    currentAgreementRec.setValue({
                                        fieldId: 'custrecord_ps_a_status',
                                        value: "3",
                                    });
                                    currentAgreementRec.save({
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        catch(exp){
            log.error({ title : "Error In Map Function", details : JSON.stringify(exp)});
        }
    }

    function isAllAgreementDetailCancelled(agreementId){
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement",
            filters:
            [
               ["internalid","anyof", agreementId], 
               "AND", 
               ["custrecord_ps_aad_agreement.custrecord_ps_aad_status","noneof","3"]
            ],
            columns:
            [
               search.createColumn({
                  name: "internalid",
                  join: "CUSTRECORD_PS_AAD_AGREEMENT",
                  label: "Internal ID"
               }),
               search.createColumn({
                  name: "custrecord_ps_aad_item",
                  join: "CUSTRECORD_PS_AAD_AGREEMENT",
                  label: "Item"
               })
            ]
        });
        var agreementSrchCount = agreementSrch.runPaged().count;
        return agreementSrchCount > 0 ? false : true;
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});