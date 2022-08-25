/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

 define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format'],
function(log, search, record, moment, format) {
    function getInputData() {
        var data = [];
        var preferencesSearch = search.create({
            type: "customrecord_ps_agreement_preferences",
            filters:
            [
               ["isinactive","is","F"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_ap_subsidiary", label: "Subsidiary"}),
               search.createColumn({name: "custrecord_ps_ap_renewal_creation_das", label: "Renewal Advance Days"}),
               search.createColumn({name: "custrecord_ps_att_type_id", join: "custrecord_ps_ap_renewal_transaction_typ", label: "Renewal Type Id"})
            ]
        });
        preferencesSearch.run().each(function(currentPref){
            var agreementList = getAgreements(currentPref.getValue({name: "custrecord_ps_ap_subsidiary", label: "Subsidiary"}), 
                                    currentPref.getValue({name: "custrecord_ps_ap_renewal_creation_das", label: "Renewal Advance Days"}),
                                    currentPref.getValue({name: "custrecord_ps_att_type_id", join: "custrecord_ps_ap_renewal_transaction_typ", label: "Renewal Type Id"}));
            if(agreementList && agreementList.length > 0){
                data = data.concat(agreementList);
            }
            return true;
        });
        return data;
    }

    function map(context) {
        try{
            if (context.value) {
                var currentUserObj = runtime.getCurrentUser();
                var dateFormat = currentUserObj.getPreference({
                    name: 'dateformat'
                });
                var srchData = JSON.parse(context.value);
                if(srchData){ //  && agreementId == "2405" ---- static id for testing.
                    log.debug({title : "Search Data", details : srchData});
                    var agreementDetailList = getAgreementDetailLines(srchData.id);
                    if(agreementDetailList && agreementDetailList.length > 0){
                        log.debug({title : "Agreement Detail Data", details : agreementDetailList});
                        var agreementRec = record.load({
                            type: "customrecord_ps_agreement",
                            id : srchData.id
                        });
                        var newRenewalTran = record.create({
                            type: srchData.renewalTranType, 
                            isDynamic: true,
                            defaultValues: {
                                entity: srchData.customer
                            }
                        });
                        newRenewalTran.setValue({fieldId : "custbody_ps_agreement_term", 
                                                value: agreementRec.getValue("custrecord_ps_a_contract_term")});
                        newRenewalTran.setValue({fieldId : "custbody_ps_billing_frequency", 
                                                value: agreementDetailList[0].billingFreq});
                        newRenewalTran.setValue({fieldId : "custbody_ps_agreement_payment_method", 
                                                value: agreementRec.getValue("custrecord_ps_a_payment_method")});
                        newRenewalTran.setValue({fieldId : "custbody_ps_create_new_agreement", value: true});
                        newRenewalTran.setValue({fieldId : "custbody_ps_agreement", value: ""});
                        newRenewalTran.setValue({fieldId : "custbody_ps_agreement_renewed_from", value: srchData.id});
                        // Add transaction line
                        for(var j = 0; j < agreementDetailList.length; j++){
                            newRenewalTran.selectNewLine({sublistId: 'item'});
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                value: agreementDetailList[j].item,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_agreement_pricing',
                                value: agreementDetailList[j].priceLevel,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_agreement_pricing_type',
                                value: agreementDetailList[j].pricingType,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_agreement_type',
                                value: agreementDetailList[j].agreementType,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_required_minimum',
                                value: agreementDetailList[j].requiredMinimum,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                value: agreementDetailList[j].qty,
                            });
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                value: agreementDetailList[j].rate,
                            });
                            if (parseFloat(agreementDetailList[j].amount || 0) < 0) {
                                newRenewalTran.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'rate',
                                    value: (parseFloat(agreementDetailList[j].amount) / parseFloat(agreementDetailList[j].qty)).toFixed(2),
                                });
                                newRenewalTran.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    value: agreementDetailList[j].amount,
                                });
                            }
                            else {
                                newRenewalTran.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    value: agreementDetailList[j].amount,
                                });
                            }
                            var nextRenewalDate = moment().format(dateFormat);
                            if(agreementDetailList[j].nextRenewalDate){
                                nextRenewalDate = format.parse({ value: moment(agreementDetailList[j].nextRenewalDate).format(dateFormat) , type: format.Type.DATE})
                            }
                            else if(agreementDetailList[j].endDate){
                                nextRenewalDate = format.parse({ value: moment(agreementRec.getValue("custrecord_ps_a_agreement_end_date")).add(1, "days").format(dateFormat) , type: format.Type.DATE});
                            }
                            log.debug({title : "New Start Date", details : nextRenewalDate});
                            newRenewalTran.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_agreement_start_date',
                                value: nextRenewalDate
                            });
                            newRenewalTran.commitLine({
                                sublistId: 'item'
                            });
                        }
                        var newTranId = newRenewalTran.save({
                                            enableSourcing: true,
                                            ignoreMandatoryFields: true
                                        });
                        log.debug({title : "New renewal transaction id", details: newTranId});
                        if(newTranId){
                            for(var c = 0; c < agreementDetailList.length; c++){
                                context.write({
                                    key: agreementDetailList[c].id,
                                    value: agreementDetailList[c].id
                                });
                            }
                        }
                    }
                    else{
                        log.debug({title : "No agreement detail found."});
                    }
                }
            }
        }
        catch(exp){
            log.error({ title : "Error In Map Function", details : JSON.stringify(exp)});
        }
    }

    function reduce(context) {
        try{
            log.debug({title : "Reduce | Agreement Detail Id", details : context.values});
            if(context.values){
                updateStatusInAgreementAndLines(context.values[0]);
            }
        }
        catch(error){
            log.error({title: "Error in Reduce", details : error});
        }
    }
    /**********************
     * Helper Functions****
    **********************/
    function getAgreements(subsidiary, renewalDays, renewalTranType){
        log.debug({title : "Subsidiary | Renewal Days | Renewal Tran", details : subsidiary+" | "+renewalDays+" | "+renewalTranType});
        var agreementData = [];
        if(subsidiary && renewalDays){
            var agreementSrch = search.create({
                type: "customrecord_ps_agreement",
                filters:
                [
                    ["custrecord_ps_a_agreement_end_date","isnotempty",""], 
                    "AND", 
                    ["custrecord_ps_a_agreement_end_date","onorafter","today"], 
                    "AND", 
                    ["formulanumeric: CASE WHEN ABS(TO_DATE({custrecord_ps_a_agreement_end_date})-TO_DATE({today})) = "+renewalDays+" THEN 1 ELSE 0 END","equalto","1"],
                    "AND",
                    //  ["internalid", "anyof", "4205"],
                    //  "AND",
                    ["custrecord_ps_a_subsidiary", "anyof", subsidiary]
                ],
                columns:
                [
                    search.createColumn({ name: "internalid", summary: "GROUP", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_ps_a_customer", summary: "GROUP", label: "Customer" })
                ]
            });
            agreementSrch.run().each(function(result){
                agreementData.push({
                    id : result.getValue({ name: "internalid", summary: "GROUP", label: "Internal ID" }),
                    renewalTranType : renewalTranType,
                    customer : result.getValue({ name: "custrecord_ps_a_customer", summary: "GROUP", label: "Customer" }),
                });
                return true;
            });
        }
        return agreementData;
    }
    function getAgreementDetailLines(agreementId){
        var agreementDetailList = [];
        var agreementDetailSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_status","anyof","2"], 
               "AND", 
               ["custrecord_ps_aad_agreement","anyof", agreementId]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_agreement", sort: search.Sort.ASC, label: "Agreement"}),
               search.createColumn({name: "custrecord_ps_aad_item", label: "Item"}),
               search.createColumn({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
               search.createColumn({name: "custrecord_ps_aad_end_date", label: "End Date"}),
               search.createColumn({name: "custrecord_ps_aad_status", label: "Status"}),
               search.createColumn({name: "custrecord_ps_aad_quantity", label: "Quantity"}),
               search.createColumn({name: "custrecord_ps_aad_rate", label: "Rate"}),
               search.createColumn({name: "custrecord_ps_aad_amount", label: "Amount"}),
               search.createColumn({name: "custrecord_ps_aad_required_minimum", label: "Required Minimum"}),
               search.createColumn({name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date"}),
               search.createColumn({name: "custrecord_ps_aad_pricing_type", label: "Pricing Type"}),
               search.createColumn({name: "custrecord_ps_aad_price_level", label: "Price Level"}),
               search.createColumn({name: "custrecord_ps_aad_created_from", label: "Created From"}),
               search.createColumn({name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key"}),
               search.createColumn({name: "custrecord_ps_aad_agreement_type", label: "Agreement Type"}),
               search.createColumn({name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date"}),
               search.createColumn({name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq"}),
               search.createColumn({name: "custrecord_ps_aad_next_renewal_date", label: "Next Renewal Date"}),
               
               
            ]
        });
        agreementDetailSrch.run().each(function(result){
            agreementDetailList.push({
                id : result.getValue({name: "internalid", label: "Internal ID"}),
                item : result.getValue({name: "custrecord_ps_aad_item", label: "Item"}),
                startDate : result.getValue({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
                endDate : result.getValue({name: "custrecord_ps_aad_end_date", label: "End Date"}),
                status : result.getValue({name: "custrecord_ps_aad_status", label: "Status"}),
                qty : result.getValue({name: "custrecord_ps_aad_quantity", label: "Quantity"}),
                rate : result.getValue({name: "custrecord_ps_aad_rate", label: "Rate"}),
                amount : result.getValue({name: "custrecord_ps_aad_amount", label: "Amount"}),
                requiredMinimum : result.getValue({name: "custrecord_ps_aad_required_minimum", label: "Required Minimum"}),
                nextBillingDate : result.getValue({name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date"}),
                nextRenewalDate : result.getValue({name: "custrecord_ps_aad_next_renewal_date", label: "Next Renewal Date"}),
                lastBillingDate : result.getValue({name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date"}),
                pricingType : result.getValue({name: "custrecord_ps_aad_pricing_type", label: "Pricing Type"}),
                priceLevel : result.getValue({name: "custrecord_ps_aad_price_level", label: "Price Level"}),
                createdFrom : result.getValue({name: "custrecord_ps_aad_created_from", label: "Created From"}),
                tranLineKey : result.getValue({name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key"}),
                agreementType : result.getValue({name: "custrecord_ps_aad_agreement_type", label: "Agreement Type"}),
                billingFreq : result.getValue({name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq"}),
            });
            return true;
        });
        return agreementDetailList;
    }
    function updateStatusInAgreementAndLines(agreementDetailId){
        if(agreementDetailId){
            var lookResults = search.lookupFields({
                type: 'customrecord_ps_agreement_details',
                id: agreementDetailId,
                columns: ['custrecord_ps_aad_agreement']
            });
            if(lookResults.custrecord_ps_aad_agreement && lookResults.custrecord_ps_aad_agreement.length > 0){
                var agreementId = lookResults.custrecord_ps_aad_agreement[0].value;
                //Update agreement status to renewed.
                if(agreementId){
                    record.submitFields({
                        type: "customrecord_ps_agreement",
                        id: agreementId,
                        values: {
                            custrecord_ps_a_status: '6'
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields : true
                        }
                    });
                }
                //Update agreement detail line status to renewed.
                record.submitFields({
                    type: "customrecord_ps_agreement_details",
                    id: agreementDetailId,
                    values: {
                        custrecord_ps_aad_status: '6'
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
            }
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce : reduce
    };
});