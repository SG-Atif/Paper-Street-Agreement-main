/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

 define(['N/log', 'N/search', 'N/record', './moment.min.js'], function(log, search, record, moment) {
    function getInputData() {
        var agreementDetailsSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_status","anyof","1"], //Pending Start
               "AND", 
               ["custrecord_ps_aad_agreement.custrecord_ps_a_status","noneof","3","5"]//Cancelled, Lapsed
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_agreement", label: "Agreement ID"}),
               search.createColumn({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
            ]
         });
         return agreementDetailsSrch;
    }

    function map(context) {
        try{
            if(context.value){
                var searchResult = JSON.parse(context.value);
                log.debug({ title: "Current Search Result", details: searchResult});
                if(searchResult){
                    var agreementDetailId =  searchResult.values.internalid.value;
                    var agreementId = searchResult.values.custrecord_ps_aad_agreement.value;
                    var startDate = searchResult.values.custrecord_ps_aad_start_date.value;
                    var currentdate = moment();
                    if(startDate){
                        if(moment(startDate).isSameOrBefore(currentdate)){
                            log.debug({ title: "Agreement | Detail Id", details: agreementId+" | "+agreementDetailId});
                            if(agreementId && agreementDetailId){
                                var currentAgreementDetailRec =  record.load({
                                    type: "customrecord_ps_agreement_details",
                                    id: agreementDetailId,
                                    isDynamic: false,
                                });
                                currentAgreementDetailRec.setValue({
                                    fieldId : "custrecord_ps_aad_status",
                                    value : "2"//Active
                                });
                                currentAgreementDetailRec.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });
                                if(isAgreementLinesActive(agreementId) == true){
                                    var currentAgreementRec =  record.load({
                                        type: "customrecord_ps_agreement",
                                        id: agreementId,
                                        isDynamic: false,
                                    });
                                    currentAgreementRec.setValue({
                                        fieldId : "custrecord_ps_a_status",
                                        value : "2"//Active
                                    });
                                    currentAgreementRec.save({
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true
                                    });
                                }
                            }
                        }
                    }
                    else{
                        log.debug({title: "Start date is in future."});
                    }
                }
            }
        }
        catch(exp){
            log.error({ title : "Error in map function", details : JSON.stringify(exp)});
        }
    }

    /**********************
     * Helper Functions****
     **********************/
    function isAgreementLinesActive(agreementId){
        var isActive = true;
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_status","noneof","2","3"], //Active,Cancel
               "AND", 
               ["custrecord_ps_aad_agreement","anyof", agreementId], 
               "AND", 
               ["custrecord_ps_aad_agreement.custrecord_ps_a_status","anyof","1"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"})
            ]
         });
         agreementSrch.run().each(function(result){
            isActive = false;
            return true;
         });
        return isActive;
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});