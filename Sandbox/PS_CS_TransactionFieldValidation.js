/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/error', 'N/log', 'N/search', './moment.min.js', 'N/runtime'],
function (error, log, search, moment, runtime) {
    var pageLoaderURl = '';
    function pageInit(context) {
        pageLoaderURl = getLoaderGif();
        var spinnerHTML = '<div id="cust_pageLoader" class="loader" \
                                        style="position: fixed; \
                                            display: none; width: 100%;height: 100%; \
                                            background-repeat: no-repeat; \
                                            background-attachment: fixed; \
                                            background-position: center; margin-top: -40px;\
                                            opacity: 0.7;background-color: black; z-index:99999999999999;"> \
                                    </div>';
        jQuery("body").prepend(spinnerHTML);
        var currentRecord = context.currentRecord;
        if(context.mode == 'copy'){
            currentRecord.setValue({ fieldId : "custbody_ps_agreement", value : ""});
        }
        var agreementField = currentRecord.getField("custbody_ps_agreement");
        if(currentRecord.getValue("custbody_ps_create_new_agreement") == false){
            if(context.mode == 'copy'){
                currentRecord.setValue({ fieldId : "custbody_ps_agreement", value : ""});
            }
            agreementField.isDisabled = false;
        }
        else{
            if(context.mode == 'copy'){
                currentRecord.setValue({ fieldId : "custbody_ps_agreement", value : ""});
            }
            agreementField.isDisabled = true;
        }
        // Agreement Renewed
        var NewAgreementField = currentRecord.getField("custbody_ps_create_new_agreement");
        if(currentRecord.getValue("custbody_ps_agreement_renewed_from")){
            currentRecord.setValue({ 
                fieldId : "custbody_ps_agreement_renewed_from", 
                value : true,
                ignoreFieldChange: true
            });
            NewAgreementField.isDisabled = true;
        }
    }
    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldName = context.fieldId;
        var sublistName = context.sublistId;
        if(fieldName == "custbody_ps_create_new_agreement"){
            var agreementField = currentRecord.getField("custbody_ps_agreement");
            currentRecord.setValue({ fieldId : "custbody_ps_agreement", value : ""});
            if(currentRecord.getValue("custbody_ps_create_new_agreement") == false){
                agreementField.isDisabled = false;
            }
            else{
                agreementField.isDisabled = true;
            }
        }
        if(fieldName == "custbody_ps_agreement_renewed_from"){
            var renewedValue = currentRecord.getValue({ fieldId : "custbody_ps_agreement_renewed_from", value : ""});
            var newAgreementField = currentRecord.getField("custbody_ps_create_new_agreement");
            if(renewedValue){
                newAgreementField.isDisabled = true;
                currentRecord.setValue({ fieldId : "custbody_ps_create_new_agreement", value : true});
            }
            else{
                newAgreementField.isDisabled = false;
            }
        }
        if(sublistName == "item" && fieldName == "item"){
            window.setTimeout(function(){
                currentRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ps_orignal_rate',
                    value: currentRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                            })
                });
            }, 500);
        }
    }
    function lineInit(context) {
        var currentRecord = context.currentRecord;
        var sublistName = context.sublistId;
        var headerBillingFreq = currentRecord.getValue("custbody_ps_billing_frequency");
        if (sublistName === 'item'){
            var lineBillingFreq = currentRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ps_billing_frequency'
            });
            if(!lineBillingFreq){
                currentRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ps_billing_frequency',
                    value: headerBillingFreq
                });
            }
        } 
    }
    function validateLine(context) {
        var currentRecord = context.currentRecord;
        var sublistName = context.sublistId;
        var currentUserObj = runtime.getCurrentUser();
        var dateFormat = currentUserObj.getPreference({
            name: 'dateformat'
        });
        if(sublistName == "item"){
            debugger;
            var agreementId = currentRecord.getValue('custbody_ps_agreement');
            var agreementType = currentRecord.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ps_agreement_type'  
                                });
            var billingFreq = currentRecord.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ps_billing_frequency'  
                                });
            var startDate = currentRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ps_agreement_start_date'  
                            });
            var rate = currentRecord.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate'  
                        });
            console.log(agreementType+" | "+billingFreq+" | "+startDate);
            if(agreementId && rate){
                if(agreementType){
                    var requiredFieldPopulated = true;
                    if(!billingFreq){
                        alert("Please enter billing frequency.");
                        requiredFieldPopulated = false;
                    }
                    if(!startDate){
                        alert("Please enter agreement start date.");
                        requiredFieldPopulated = false;
                    }
                    if(!rate){
                        requiredFieldPopulated = false;
                    }
                    if(requiredFieldPopulated){
                        //togglePageLoader(true);
                        //window.setTimeout(function(){
                            try{
                               var prorateVal = getProRate(startDate, agreementId, billingFreq, rate, dateFormat);
                               if(prorateVal){
                                    currentRecord.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'price',
                                        value : "-1"
                                    });
                                    currentRecord.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        value : prorateVal  
                                    });
                               } 
                            }
                            catch(error){
                                console.log(error);
                                log.error({title: "Error on line validation", details: error});
                            }
                            //togglePageLoader(false);
                        //}, 500);
                    }
                    else{
                        return false;
                    }
                }
            }
        }
        return true;
    }
    function saveRecord(context){
        var currentRecord = context.currentRecord;
        var agreementId = currentRecord.getValue("custbody_ps_agreement");
        if(agreementId){
            var tranContractTerm = currentRecord.getValue("custbody_ps_agreement_term");
            if(!tranContractTerm){
                alert("Please enter value for Contract Term.");
                return false;
            }
        }
        // Line start date
        var lineCount = currentRecord.getLineCount({
            sublistId: 'item'
        });
        if(lineCount > 0){
            var agreementStartDate, SubscriptType, billingFreq;
            for(var i = 0; i < lineCount; i++){
                SubscriptType = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ps_agreement_type',
                    line: i,
                });
                if(SubscriptType){
                    agreementStartDate = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ps_agreement_start_date',
                        line: i,
                    });
                    billingFreq = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ps_billing_frequency',
                        line: i,
                    });
                    console.log(agreementStartDate);
                    if(!agreementStartDate){
                        alert("Please enter start date on line "+(i+1)+".");
                        return false;
                    }
                    if(!billingFreq){
                        alert("Please enter billing frequency on line "+(i+1)+".");
                        return false;
                    }
                }
            }
        }
        return true;
    }
    /**********************
     * Helper Functions****
    **********************/
    function getLoaderGif(){
        var url = '';
        var fileSearchObj = search.create({
            type: "file",
            filters:
            [
                ["name","is","Loader.gif"]
            ],
            columns:
            [
                search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"}),
                search.createColumn({name: "url", label: "URL"})
            ]
            });
            var searchResultCount = fileSearchObj.runPaged().count;
            log.debug("fileSearchObj result count",searchResultCount);
            fileSearchObj.run().each(function(result){
                url = result.getValue({name: "url", label: "URL"});
            return true;
        });
        return url;
    }
    function togglePageLoader(isShow) {
        var pageloader = document.getElementById("cust_pageLoader");
        if (isShow) {
            pageloader.style.backgroundImage = "url("+pageLoaderURl+")";
            pageloader.style.display = "block";
        } else {
            pageloader.style.display = "none";
        }
    }
    function getProRate(startDate, agreementId, billingFreq, rate, dateFormat){
        var prorate = null;
        var nextBillingDateSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_agreement","anyof", agreementId], 
               "AND", 
               ["custrecord_ps_aad_billing_frequency","anyof", billingFreq], 
               "AND", 
               ["custrecord_ps_aad_next_billing_date","onorafter", moment(startDate).format(dateFormat)], 
               "AND", 
               ["custrecord_ps_aad_status","anyof","2"]
            ],
            columns:
            [
               search.createColumn({
                  name: "custrecord_ps_aad_agreement",
                  summary: "GROUP",
                  label: "Agreement"
               }),
               search.createColumn({
                  name: "custrecord_ps_aad_next_billing_date",
                  summary: "MAX",
                  sort: search.Sort.ASC,
                  label: "Next Billing Date"
               }),
               search.createColumn({
                   name: "custrecord_ps_ct_time",
                   join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                   summary: "GROUP",
                   label: "Time"
               }),
               search.createColumn({
                   name: "custrecord_ps_ct_quantity",
                   join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                   summary: "MAX",
                   label: "Quantity"
               })
            ]
        });
        nextBillingDateSrch.run().each(function(result){
            var nextBillingDate = result.getValue({
                name: "custrecord_ps_aad_next_billing_date",
                summary: "MAX",
                sort: search.Sort.ASC,
                label: "Next Billing Date"
             });
             if(nextBillingDate){
                var time = result.getValue({
                            name: "custrecord_ps_ct_time",
                            join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                            summary: "GROUP",
                            label: "Time"
                        });
                var qty = result.getValue({
                            name: "custrecord_ps_ct_quantity",
                            join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",
                            summary: "MAX",
                            label: "Quantity"
                        });
                var days = moment(nextBillingDate).diff(moment(startDate), 'days');
                if(days){
                    days = parseFloat(days);
                    rate = parseFloat(rate);
                    if(rate && qty && time){
                        rate = parseFloat(rate||0);
                        qty = parseFloat(qty|0);
                        prorate = rate;
                        var timeId = getBillingFreqTimeScriptId(time);
                        if(timeId == "days"){
                            prorate = rate/(qty*1);
                        }
                        else if(timeId == "weeks"){
                            prorate = rate/(qty*7);
                        }
                        else if(timeId == "months"){
                            prorate = rate/(qty*30);
                        }
                        else if(timeId == "quarters"){
                            prorate = rate/(qty*90);
                        }
                        else if(timeId == "years"){
                            prorate = rate/(qty*365);
                        }
                        else{
                            prorate = rate/1;
                        }
                    }
                    if(prorate){
                        prorate = prorate*days;
                    }
                }
           }
        });
        return prorate ? prorate.toFixed(2) : prorate;
    }
    function getBillingFreqTimeScriptId(id){
        var lookResults = search.lookupFields({
            type: 'customrecord_ps_time',
            id: id,
            columns: ['custrecord_ps_t_script_name']
        });
        return lookResults.custrecord_ps_t_script_name;
    }

    return {
        pageInit : pageInit,
        fieldChanged : fieldChanged,
        saveRecord : saveRecord,
        lineInit : lineInit,
        validateLine : validateLine
    };
 });