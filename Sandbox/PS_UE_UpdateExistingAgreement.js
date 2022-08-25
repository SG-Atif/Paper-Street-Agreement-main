/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format'], 
 function(log, search, record, moment, format) {
    
    function afterSubmit(context) {
        if (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) {
            try{
                log.debug({ title: "Current Context", details : context.type });
                var currentRecId = context.newRecord.id;
                var currentRecType = context.newRecord.type;
                log.debug({ title: "Record Id", details: currentRecId });
                if(currentRecId){
                    var currentTranRec =  record.load({
                        type: currentRecType,
                        id: currentRecId,
                        isDynamic: false,
                    });
                    var agreementId = currentTranRec.getValue("custbody_ps_agreement");
                    var requestForNewAgreement = currentTranRec.getValue("custbody_ps_create_new_agreement");
                    log.debug({ title: "Agreement Id | is New Agreement", details : agreementId +" | "+ requestForNewAgreement });
                    if (context.type == context.UserEventType.CREATE){
                        if(requestForNewAgreement == true){
                            var isAgreementLineExist = orderHasAnyAgreementItem(currentRecId);
                            if(isAgreementLineExist == false){
                                requestForNewAgreement = false;
                                currentTranRec.getValue("custbody_ps_create_new_agreement", false);
                            }
                        }
                    }
                    if(agreementId && requestForNewAgreement == false){
                        var agreementLookup = search.lookupFields({
                            type: 'customrecord_ps_agreement',
                            id: agreementId,
                            columns: ['custrecord_ps_a_agreement_end_date']
                        });
                        var endDate = agreementLookup.custrecord_ps_a_agreement_end_date;
                        var transactionLines = getTransactionLines(currentRecId, endDate);
                        log.debug({ title: "Transaction Lines Data", details : JSON.stringify(transactionLines) });
                        if(transactionLines && transactionLines.length > 0){
                                generateAgreementDetails(transactionLines, agreementId, currentRecId);
                        }
                    }
                }
            }
            catch(error){
                log.error({ title : "Error on after submit", details : JSON.stringify(error) });
            }
        }
    }
    /**********************
     * Helper Functions****
     **********************/
    function getTransactionLines(tranId, endDate){
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
               ["custcol_ps_agreement_type","noneof","@NONE@"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID" }),
               search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
               search.createColumn({name: "item", sort: search.Sort.ASC, label: "Item" }),
               search.createColumn({name: "quantity", label: "Quantity"}),
               search.createColumn({name: "fxrate", label: "Item Rate"}),
               search.createColumn({name: "pricelevel", label: "Price Level"}),
               search.createColumn({name: "fxamount", label: "Amount"}),
               search.createColumn({name: "custbody_ps_billing_frequency", label: "Billing Frequency"}),
               search.createColumn({name: "custbody_ps_agreement", label: "Agreement"}),
               search.createColumn({name: "custcol_ps_agreement_start_date", label: "Agreement Start Date"}),
               search.createColumn({name: "custcol_ps_agreement_end_date", label: "Agreement End Date"}),
               search.createColumn({name: "statusref", label: "Status"}),
               search.createColumn({name: "custcol_ps_agreement_pricing", label: "Agreement Pricing"}),
               search.createColumn({name: "custcol_ps_agreement_pricing_type", label: "Agreement Pricing Type"}),
               search.createColumn({name: "custcol_ps_agreement_term_end_action", label: "Term End Action"}),
               search.createColumn({name: "custcol_ps_agreement_type", label: "Agreement Type"}),
            ]
         });
         transactionLineSearch.run().each(function(line){
             var lineItem = line.getValue({name: "item", sort: search.Sort.ASC, label: "Item" });
             if(lineItem){
                lineData.push({
                    lineKey : line.getValue({name: "lineuniquekey", label: "Line Unique Key"}),
                    item : line.getValue({name: "item", sort: search.Sort.ASC, label: "Item" }),
                    qty : line.getValue({name: "quantity", label: "Quantity"}),
                    rate : line.getValue({name: "fxrate", label: "Item Rate"}),
                    priceLevel : line.getValue({name: "pricelevel", label: "Price Level"}),
                    amount : line.getValue({name: "fxamount", label: "Amount"}),
                    billingFreq : line.getValue({name: "custbody_ps_billing_frequency", label: "Billing Frequency"}),
                    agreement : line.getValue({name: "custbody_ps_agreement", label: "Agreement"}),
                    startDate : line.getValue({name: "custcol_ps_agreement_start_date", label: "Start Date"}),
                    endDate : moment(line.getValue({name: "custcol_ps_agreement_end_date", label: "End Date"})).isAfter(moment(endDate))
                                ? endDate : line.getValue({name: "custcol_ps_agreement_end_date", label: "End Date"}),
                    status : line.getValue({name: "statusref", label: "Status"}),
                    agreementPricing : line.getValue({name: "custcol_ps_agreement_pricing", label: "Agreement Pricing"}),
                    agreementPricingType : line.getValue({name: "custcol_ps_agreement_pricing_type", label: "Agreement Pricing Type"}),
                    status : line.getValue({name: "statusref", label: "Status"}),
                    endTermAction : line.getValue({name: "custcol_ps_agreement_term_end_action", label: "Term End Action"}),
                    agreementType : line.getValue({name: "custcol_ps_agreement_type", label: "Agreement Type"}),
                });
             }
            return true;
         });
         return lineData;
    }
    function generateAgreementDetails(tranLineData, agreementId, tranId){
        var currentDate = moment();
        for(var i = 0; i < tranLineData.length; i++){
            try{
                var newAgreementDetailRec = null;
                var exsitingDetailId = agreementDetailLineAlreadyExist(tranLineData[i].lineKey, agreementId);
                if(exsitingDetailId){
                    newAgreementDetailRec = record.load({
                        type: 'customrecord_ps_agreement_details',
                        id : exsitingDetailId,
                        isDynamic: true,
                    });
                }
                else{
                    newAgreementDetailRec = record.create({
                        type: 'customrecord_ps_agreement_details',
                        isDynamic: true,
                    });
                }
                
                if(newAgreementDetailRec){
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement', value: agreementId });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_item', value: tranLineData[i].item });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_quantity', value: tranLineData[i].qty });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_rate', value: tranLineData[i].rate });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_price_level', value: tranLineData[i].agreementPricing });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_amount', value: tranLineData[i].amount });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_billing_frequency', value: tranLineData[i].billingFreq });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_created_from', value: tranId });
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_tran_line_key', value: tranLineData[i].lineKey });
                    if(tranLineData[i].agreementType){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement_type', value: tranLineData[i].agreementType});
                    }
                    if(tranLineData[i].startDate){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_start_date', value: format.parse({value: tranLineData[i].startDate, type: format.Type.DATE}) });
                    }
                    if(tranLineData[i].endDate){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_end_date', value: format.parse({value: tranLineData[i].endDate, type: format.Type.DATE}) });
                    }
                    if(moment(tranLineData[i].startDate).isSameOrBefore(currentDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '2'});
                    }
                    else{
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '1'});
                    }
                    var newAgreementDetailId = newAgreementDetailRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    log.debug({ title: "Agreement Detail Id", details : newAgreementDetailId});
                }
                
            }
            catch(error){
                log.error({ title : "Error in generateAgreementDetails()", details : JSON.stringify(error)});
            }
        }
    }
    function agreementDetailLineAlreadyExist(lineKey, agreementId){
        var internalId = null;
        var lineSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
                ["custrecord_ps_aad_tran_line_key","is", lineKey],
                "AND",
                ["custrecord_ps_aad_agreement","anyof", agreementId]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_item", label: "Item"}),
            ]
        });
        lineSrch.run().each(function(result){
            internalId = result.getValue({name: "internalid", label: "Internal ID"});
            return true;
        });
        return internalId;
    }
    function orderHasAnyAgreementItem(id){
        var response = false;
        var soItemSrch = search.create({
            type: "transaction",
            filters:
            [
               ["internalid","anyof", id], 
               "AND", 
               ["item.custitem_ps_agreement_item","noneof","@NONE@"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "tranid", label: "Document Number"})
            ]
        });
        soItemSrch.run().each(function(result){
            response = true;
        });
        return response;
    }

    return {
        afterSubmit: afterSubmit,
    }
});