/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format', 'N/runtime'],
function (log, search, record, moment, format, runtime) {
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
               search.createColumn({name: "custrecord_ps_ap_use_cancel_tran", label: "Use Cancellation Transaction"}),
               search.createColumn({name: "custrecord_ps_ap_agreement_tran_status", label: "Agreement Transaction Status"}),
               search.createColumn({name: "custrecord_ps_att_type_id", join: "custrecord_ps_ap_agreement_creation_tran", label: "Type Id"})
            ]
        });
        preferencesSearch.run().each(function(currentPref){
            var transactionStatus = currentPref.getText({name: "custrecord_ps_ap_agreement_tran_status", label: "Agreement Transaction Status"});
            var transactionType = currentPref.getValue({ name: "custrecord_ps_att_type_id", join: "custrecord_ps_ap_agreement_creation_tran", label: "Type Id"});
            if(transactionStatus){
                transactionStatus = transactionStatus.split(":");
                if(transactionStatus.length > 0){
                    transactionStatus = transactionStatus[1];
                }
            }
            log.debug({title: "Transaction Type | Status", details : transactionType +" | "+ transactionStatus});
            var transactionData = getTransactions(
                                    currentPref.getValue({name: "custrecord_ps_ap_subsidiary", label: "Subsidiary"}), 
                                    transactionType, transactionStatus);
            if(transactionData && transactionData.length > 0){
                data = data.concat(transactionData);
            }
            return true;
        });
        log.debug({ title : "Data", details : data});
        return data;
    }

    function map(context) {
        try{
            if(context.value){
                var searchResult = JSON.parse(context.value);
                if (searchResult.id) {
                    var currentUserObj = runtime.getCurrentUser();
                    var dateFormat = currentUserObj.getPreference({
                        name: 'dateformat'
                    });
                    var lineData = getTransactionLines(searchResult.id);
                    if(lineData && lineData.length > 0){
                        searchResult.lines = lineData;
                        log.debug({ title: "Current Transaction Data", details: searchResult});
                        var agreementId = generateAgreement(searchResult);
                        log.debug({ title: "New Agreement Id", details: agreementId});
                        if(agreementId){
                            //Update agreement Id in the transation
                            record.submitFields({
                                type: searchResult.recordType,
                                id: searchResult.id,
                                values: { custbody_ps_agreement: agreementId },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields : true
                                }
                            });
                            if(searchResult.renewedFrom){
                                context.write({
                                    key: searchResult.renewedFrom,
                                    value: agreementId
                                }); 
                            }
                            generateAgreementDetails(searchResult, agreementId, dateFormat);
                        }
                    }
                }
            }
        }
        catch(exp){
            log.error({ title : "Error In Map Function", details : JSON.stringify(exp)});
        }
    }

    function reduce(context){
        try{
            log.debug({title : "Reduce", details : context});
            if(context.values && context.key){
                createRenewalConclusionRecord(context.key, context.values[0]);
            }
        }
        catch(error){
            log.error({title: "Error in Reduce", details : error});
        }
    }

    /**********************
     * Helper Functions****
     **********************/
    function getTransactions(Subsidiary, transactionType, status){
        var transactionData = [];
        if(Subsidiary && transactionType){
            var srchfilters =   [
                ["custbody_ps_agreement","anyof","@NONE@"],
                "AND", 
                ["formulanumeric: CASE WHEN {status} = '"+status+"' THEN 1 ELSE 0 END","equalto","1"], 
                "AND", 
                ["custbody_ps_create_new_agreement","is","T"], 
                "AND", 
                ["subsidiary","anyof", Subsidiary], 
                "AND", 
                ["mainline","is","F"], 
                "AND", 
                ["taxline","is","F"], 
                "AND", 
                ["shipping","is","F"], 
                "AND", 
                ["cogs","is","F"]
            ];
            if(status){
                srchfilters.push("AND");
                srchfilters.push(["formulanumeric: CASE WHEN {status} = '"+status+"' THEN 1 ELSE 0 END","equalto","1"]);
            }
            var transactionSearch = search.create({
                type: transactionType,
                filters: srchfilters,
                columns:
                [
                    search.createColumn({ name: "internalid", summary: "GROUP", label: "Internal ID" }),
                    search.createColumn({ name: "tranid", summary: "MAX", label: "Document Number" }),
                    search.createColumn({ name: "custbody_ps_billing_frequency", summary: "GROUP", label: "Billing Frequency" }),
                    search.createColumn({ name: "custbody_ps_agreement_term", summary: "GROUP", label: "Contract Term" }),
                    search.createColumn({ name: "entity", summary: "GROUP", label: "Name" }),
                    search.createColumn({ name: "subsidiary", summary: "GROUP", label: "Subsidiary" }),
                    search.createColumn({ name: "currency", summary: "GROUP", label: "Currency" }),
                    search.createColumn({ name: "custbody_ps_agreement_payment_method", summary: "GROUP", label: "Agreement Payment Method" }),
                    search.createColumn({ name: "custcol_ps_agreement_start_date", summary: "MIN", label: "Agreement Start Date" }),
                    search.createColumn({ name: "custcol_ps_agreement_end_date", summary: "MAX", label: "Agreement End Date" }),
                    search.createColumn({ name: "recordtype", summary: "GROUP", label: "Record Type" }),
                    search.createColumn({ name: "custbody_ps_required_minimum", summary: "MAX", label: "Required Minimum" }),
                    search.createColumn({ name: "custbody_ps_agreement_renewed_from", summary: "GROUP", label: "Renewed From" })
                ]
            });
            transactionSearch.run().each(function(result){
                transactionData.push({
                    id : result.getValue({ name: "internalid", summary: "GROUP", label: "Internal ID" }),
                    documentNumber : result.getValue({ name: "tranid", summary: "MAX", label: "Document Number" }),
                    billingFreq : result.getValue({ name: "custbody_ps_billing_frequency", summary: "GROUP", label: "Billing Frequency" }),
                    contractTerm : result.getValue({ name: "custbody_ps_agreement_term", summary: "GROUP", label: "Contract Term" }),
                    subsidiary : result.getValue({name: "subsidiary", summary: "GROUP", label: "Subsidiary"}),
                    customer : result.getValue({ name: "entity", summary: "GROUP", label: "Name" }),
                    paymentMethod : result.getValue({ name: "custbody_ps_agreement_payment_method", summary: "GROUP", label: "Agreement Payment Method" }),
                    startDate : result.getValue({ name: "custcol_ps_agreement_start_date", summary: "MIN", label: "Agreement Start Date" }),
                    endDate : result.getValue({ name: "custcol_ps_agreement_end_date", summary: "MAX", label: "Agreement End Date" }),
                    currency : result.getValue({ name: "currency", summary: "GROUP", label: "Currency" }),
                    recordType : result.getValue({ name: "recordtype", summary: "GROUP", label: "Record Type" }),
                    requiredMinimum : result.getValue({ name: "custbody_ps_required_minimum", summary: "MAX", label: "Required Minimum" }),
                    renewedFrom : result.getValue({ name: "custbody_ps_agreement_renewed_from", summary: "GROUP", label: "Renewed From" }),
                });
                return true;
            });
        }
        return transactionData;
    }
    function getTransactionLines(tranId){
        var lineData = [];
        var transactionLineSearch = search.create({
            type: "transaction",
            filters:
            [
               ["internalid","anyof", tranId], 
               "AND", 
               ["mainline","is","F"], 
               "AND", 
               ["taxline","is","F"], 
               "AND", 
               ["shipping","is","F"], 
               "AND", 
               ["cogs","is","F"], 
               "AND", 
               ["item.custitem_ps_agreement_item","noneof","@NONE@"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID" }),
               search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
               search.createColumn({name: "item", sort: search.Sort.ASC, label: "Item" }),
               search.createColumn({name: "quantity", label: "Quantity"}),
               search.createColumn({name: "fxrate", label: "Item Rate"}),
               search.createColumn({name: "fxamount", label: "Amount"}),
               search.createColumn({name: "custbody_ps_billing_frequency", label: "Billing Frequency"}),
               search.createColumn({name: "custbody_ps_agreement", label: "Agreement"}),
               search.createColumn({name: "custcol_ps_agreement_start_date", label: "Agreement Start Date"}),
               search.createColumn({name: "custcol_ps_agreement_end_date", label: "Agreement End Date"}),
               search.createColumn({name: "statusref", label: "Status"}),
               search.createColumn({name: "custcol_ps_agreement_pricing", label: "Agreement Pricing"}),
               search.createColumn({name: "custcol_ps_agreement_pricing_type", label: "Agreement Pricing Type"}),
               search.createColumn({name: "custcol_ps_agreement_term_end_action", label: "Term End Action"}),
               search.createColumn({name: "custcol_ps_required_minimum", label: "Required Minimum"}),
               search.createColumn({name: "custcol_ps_agreement_type", label: "Agreement Type"}),
               search.createColumn({name: "custcol_ps_billing_frequency", label: "Line Billing Frequency"}),
               search.createColumn({name: "closed", label: "Closed"}),
            ]
         });
         transactionLineSearch.run().each(function(line){
             var lineItem = line.getValue({name: "item", sort: search.Sort.ASC, label: "Item" });
             log.debug({title: "is line closed", details : line.getValue({name: "closed", label: "Closed"}) });
             if(lineItem){
                lineData.push({
                    lineKey : line.getValue({name: "lineuniquekey", label: "Line Unique Key"}),
                    item : line.getValue({name: "item", sort: search.Sort.ASC, label: "Item" }),
                    qty : line.getValue({name: "quantity", label: "Quantity"}),
                    rate : line.getValue({name: "fxrate", label: "Item Rate"}),
                    amount : line.getValue({name: "fxamount", label: "Amount"}),
                    billingFreq: line.getValue({ name: "custcol_ps_billing_frequency", label: "Line Billing Frequency" })
                        ? line.getValue({ name: "custcol_ps_billing_frequency", label: "Line Billing Frequency" })
                        : line.getValue({ name: "custbody_ps_billing_frequency", label: "Billing Frequency" }),
                    agreement : line.getValue({name: "custbody_ps_agreement", label: "Agreement"}),
                    startDate : line.getValue({name: "custcol_ps_agreement_start_date", label: "Start Date"}),
                    endDate : line.getValue({name: "custcol_ps_agreement_end_date", label: "End Date"}),
                    status : line.getValue({name: "statusref", label: "Status"}),
                    agreementPricing : line.getValue({name: "custcol_ps_agreement_pricing", label: "Agreement Pricing"}),
                    agreementPricingType : line.getValue({name: "custcol_ps_agreement_pricing_type", label: "Agreement Pricing Type"}),
                    status : line.getValue({name: "statusref", label: "Status"}),
                    endTermAction : line.getValue({name: "custcol_ps_agreement_term_end_action", label: "Term End Action"}),
                    requiredMinimum : line.getValue({name: "custcol_ps_required_minimum", label: "Required Minimum"}),
                    agreementType : line.getValue({name: "custcol_ps_agreement_type", label: "Agreement Type"}),
                    isClosed : line.getValue({name: "closed", label: "Closed"})
                });
             }
            return true;
         });
         return lineData;
    }
    function generateAgreement(tranData){
        var currentDate = moment();
        var newAgreementRec = record.create({
            type: 'customrecord_ps_agreement',
            isDynamic: true,
        });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_customer', value: tranData.customer });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_payment_method', value: tranData.paymentMethod });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_subsidiary', value: tranData.subsidiary });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_currency', value: tranData.currency });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_contract_term', value: tranData.contractTerm });
        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_required_monthly_min', value: '' });
        if(tranData.requiredMinimum){
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_required_monthly_min', value: tranData.requiredMinimum});
        }
        if(tranData.startDate){
            log.debug({ title: "Agreement Start Date", details : tranData.startDate });
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_start', value: format.parse({value: tranData.startDate , type: format.Type.DATE}) });
        }
        if(tranData.endDate){
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_end_date', value: format.parse({value: tranData.endDate , type: format.Type.DATE}) });
        }
        else{
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_evergreen', value: true });
        }
        if(moment(tranData.startDate).isSameOrBefore(currentDate)){
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '2' });
        }
        else{
            newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '1' }); 
        }
        var newAgreementId = newAgreementRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
        return newAgreementId;
    }
    function generateAgreementDetails(tranData, agreementId, dateFormat){
        var currentDate = moment();
        if(tranData.lines && tranData.lines.length > 0){
            log.debug({title : "Lines", details : JSON.stringify(tranData.lines)});
            for(var i = 0; i < tranData.lines.length; i++){
                try{
                    var newAgreementDetailRec = record.create({
                        type: 'customrecord_ps_agreement_details',
                        isDynamic: true,
                    });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement', value: agreementId });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_item', value: tranData.lines[i].item });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_quantity', value: tranData.lines[i].qty });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_rate', value: tranData.lines[i].rate });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_price_level', value: tranData.lines[i].agreementPricing });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_amount', value: tranData.lines[i].amount });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_billing_frequency', value: tranData.lines[i].billingFreq });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_created_from', value: tranData.id });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_tran_line_key', value: tranData.lines[i].lineKey });
                    if(tranData.lines[i].agreementPricingType){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_pricing_type', value: tranData.lines[i].agreementPricingType});
                    }
                    if(tranData.lines[i].agreementType){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement_type', value: tranData.lines[i].agreementType});
                    }
                    if(tranData.lines[i].requiredMinimum){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_required_minimum', value: tranData.lines[i].requiredMinimum});
                    }
                    if(tranData.lines[i].startDate){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_start_date', value: format.parse({value: tranData.lines[i].startDate, type: format.Type.DATE}) });
                    }
                    if(tranData.lines[i].endDate){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_end_date', value: format.parse({value: tranData.lines[i].endDate, type: format.Type.DATE}) });
                        var nextRenewalDate = moment(tranData.lines[i].endDate).add(1, 'days').format(dateFormat)
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_renewal_date', value: format.parse({value: nextRenewalDate, type: format.Type.DATE}) });   
                    }
                    if(tranData.lines[i].isClosed == true){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '3'});
                    }
                    else if(moment(tranData.lines[i].startDate).isSameOrBefore(currentDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '2'});
                    }
                    else{
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '1'});
                    }
                    var newAgreementDetailId = newAgreementDetailRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    log.debug({ title: "New Agreement Detail Id", details : newAgreementDetailId});
                }
                catch(error){
                    log.error({ title : "Error in generateAgreementDetails()", details : JSON.stringify(error)});
                }
            }
        }
    }
    function createRenewalConclusionRecord(renewedFromId, agreementId){
        if(renewedFromId && agreementId){
            var conclusionRec = record.create({
                type: "customrecord_ps_agreement_conculsion",
                isDynamic: true,
            });
            conclusionRec.setValue({
                fieldId : "custrecord_ps_ac_concluding_event",
                value : "1"
            });
            conclusionRec.setValue({
                fieldId : "custrecord_ps_ac_agreement",
                value : renewedFromId
            });
            conclusionRec.setValue({
                fieldId : "custrecord_ps_renewed_agreement",
                value : agreementId
            });
            conclusionRec.setValue({
                fieldId : "custrecord_ps_ac_effective_date",
                value : format.parse({value: new Date(), type: format.Type.DATE})
            });
            var newId = conclusionRec.save({
                enableSourcing: true, 
                ignoreMandatoryFields: true 
            });
            log.debug({title : "New Renewal Conclusion Rec Id", details : newId});
        }
    }
    function isEmpty(value) {
        if (value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
        return false;
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce : reduce
    };
});