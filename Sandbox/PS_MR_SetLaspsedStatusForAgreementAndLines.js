/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/runtime'], function (log, search, record, moment, runtime) {
    function getInputData() {
        var agreementDetailsSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
                ["custrecord_ps_aad_end_date", "before", new Date()],
                "AND",
                ["custrecord_ps_aad_status", "anyof", "2"]
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
                if (searchResult) {
                    var agreementDetailId =  searchResult.values.internalid.value;
                    var agreementId = searchResult.values.custrecord_ps_aad_agreement.value;
                    if (agreementDetailId){
                        var currentAgreementDetailRec = record.load({
                            type: "customrecord_ps_agreement_details",
                            id: agreementDetailId,
                            isDynamic: false,
                        });
                        currentAgreementDetailRec.setValue({
                            fieldId: "custrecord_ps_aad_status",
                            value: "5"//Lapsed
                        });
                        currentAgreementDetailRec.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        if (isAgreementExpire(agreementId) == true) {
                            var currentAgreementRec = record.load({
                                type: "customrecord_ps_agreement",
                                id: agreementId,
                                isDynamic: false,
                            });
                            currentAgreementRec.setValue({
                                fieldId: "custrecord_ps_a_status",
                                value: "5"//Lapsed
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
        catch(exp){
            log.error({ title : "Error in map function", details : JSON.stringify(exp)});
        }
    }

    /**********************
     * Helper Functions****
     **********************/
    function isAgreementExpire(agreementId){
        var isActive = false;
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement",
            filters:
              [
                ["internalid", "anyof", agreementId],
                "AND",
                ["custrecord_ps_a_status","noneof","2"], //Active
                "AND", 
                ["custrecord_ps_a_agreement_end_date","before", new Date()],
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"})
            ]
         });
         agreementSrch.run().each(function(result){
            isActive = true;
            return true;
         });
        return isActive;
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});