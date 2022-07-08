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
                ["custrecord_ps_aad_next_billing_date","isempty",""], 
               // "OR", 
               // ["custrecord_ps_aad_next_billing_date","on","today"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_agreement", label: "Agreement"}),
               search.createColumn({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
               search.createColumn({name: "custrecord_ps_aad_end_date", label: "End Date"}),
               search.createColumn({name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date"}),
               search.createColumn({name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency"}),
               search.createColumn({
                  name: "custrecord_ps_ct_time",
                  join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                  label: "Time"
               }),
               search.createColumn({
                  name: "custrecord_ps_ct_quantity",
                  join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                  label: "Quantity"
               })
            ]
         });
         log.debug("agreementDetailsSrch result count", agreementDetailsSrch.runPaged().count);
         return agreementDetailsSrch;
    }

    function map(context) {
        try{
            if(context.value){
                var searchResult = JSON.parse(context.value);
                log.debug({ title: "Current Search Result", details: searchResult});
                var data = {
                    id : searchResult.values.internalid.value,
                    agreementId : searchResult.values.custrecord_ps_aad_agreement.value,
                    startDate : searchResult.values.custrecord_ps_aad_start_date,
                    endDate : searchResult.values.custrecord_ps_aad_end_date,
                    nextBillingDate : searchResult.values.custrecord_ps_aad_next_billing_date,
                    billingFreq : searchResult.values.custrecord_ps_aad_billing_frequency.value,
                    billingFreqQty : searchResult.values['custrecord_ps_ct_quantity.CUSTRECORD_PS_AAD_BILLING_FREQUENCY'],
                    billingFreqTime : searchResult.values['custrecord_ps_ct_time.CUSTRECORD_PS_AAD_BILLING_FREQUENCY'].value,
                };
                if(data['billingFreqTime']){
                    data['billingFreqScriptid'] = getBillingFreqTimeScriptId(data['billingFreqTime']);
                }
                log.debug({ title : "Data detail", details : data});
                var response = getExistingLinesBillingDate(data['agreementId'], data['billingFreq'], data['startDate']);
                var newNextBillingDate = response.newNextBillingDate;
                if(isEmpty(newNextBillingDate) && response.isDateFound == false){
                    newNextBillingDate = getNextBillingDate(data['startDate'], data['nextBillingDate'], data['billingFreqQty'], 
                                                data['billingFreqScriptid'], data['endDate']);
                } 
                log.debug({ title : "New Next Billing Date", details : newNextBillingDate});
                if(newNextBillingDate){
                    updateAgreementDetail(data['id'], newNextBillingDate);
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
    function getBillingFreqTimeScriptId(id){
        var lookResults = search.lookupFields({
            type: 'customrecord_ps_time',
            id: id,
            columns: ['custrecord_ps_t_script_name']
        });
        return lookResults.custrecord_ps_t_script_name;
    }
    function getNextBillingDate(startDate, previousBillingDate, qty, timeId, endDate){
        if(previousBillingDate){
            startDate = previousBillingDate;
        }
        var nextBillingDate = '';
        if(startDate && qty && timeId){
            log.debug({title : "startDate | qty | timeId", details : startDate+" | "+qty+" | "+timeId});
            nextBillingDate = moment(startDate).add(qty, timeId).format("MM/DD/YYYY");
            if(nextBillingDate){
                var current = moment();
                log.debug({title : "Current | Next Billing Date", details : current +" | "+ nextBillingDate});
                if(moment(nextBillingDate).isBefore(current)){//isSameOrBefore
                    nextBillingDate = getNextBillingDate('', nextBillingDate, qty, timeId, endDate);
                }
            }
        }
        if(endDate){
            if(moment(nextBillingDate).isAfter(moment(endDate))){//isSameOrAfter
                nextBillingDate = endDate;
            }
        }
        return nextBillingDate? moment(nextBillingDate).format('MM/DD/YYYY') : '';
    }
    function updateAgreementDetail(id, nextBillingDate){
        var currentDetailRec = record.load({
            type : 'customrecord_ps_agreement_details',
            id : id
        });
        currentDetailRec.setValue({
            fieldId: 'custrecord_ps_aad_next_billing_date',
            value: new Date(nextBillingDate),
        });
        currentDetailRec.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });
    }
    function getExistingLinesBillingDate(agreementId, billingFreq, startDate){
        var response = {
            newNextBillingDate : null,
            isDateFound : false
        }
        var exsitingBillingDateSsrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_agreement","anyof", agreementId], 
               "AND", 
               ["custrecord_ps_aad_billing_frequency","anyof", billingFreq], 
               "AND", 
               ["custrecord_ps_aad_next_billing_date","onorafter","today"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_item", label: "Item"}),
               search.createColumn({name: "custrecord_ps_aad_next_billing_date", sort: search.Sort.ASC, label: "Next Billing Date"})
            ]
        });
        exsitingBillingDateSsrch.run().each(function(result){
            response.isDateFound = true;
            response.newNextBillingDate = result.getValue({name: "custrecord_ps_aad_next_billing_date", sort: search.Sort.ASC, label: "Next Billing Date"});
        });
        log.debug({title : "Existing Next Billing Date", details : response.newNextBillingDate});
        if(response.newNextBillingDate && startDate){
            if(moment(startDate).isSameOrAfter(moment(response.newNextBillingDate))){
                response.newNextBillingDate = null;
            }
        }
        return response;
    }
    function isEmpty(value) {
        if (value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
        return false;
    }

    return {
        getInputData: getInputData,
        map: map,
    };
});