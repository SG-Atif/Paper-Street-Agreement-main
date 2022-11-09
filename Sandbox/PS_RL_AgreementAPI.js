/**
 * @NApiVersion 2.x
 * @NScriptType restlet
*/
 define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format', 'N/url'],
 function(log, search, record, moment, format, url) {
    /***************************
    * Global Properties
    ****************************/
    var response = {
        isValid : false,
        message: "",
        data: null
    }
    var postResponse = {
        success : [],
        fail : []
    }
    /***************************
    * Restlet Events
    ****************************/
    function triggerAPIGetEvent(context) {
        log.debug({title: "Context -- GET", details: context});
        if(context.method == 'GetAgreements'){
            log.debug({title: "Get Agreements"});
            response = getAgreements(context);
        }
        log.debug({title: "Request End"});
        return JSON.stringify(response);
    }
    function triggerAPIPostEvent(context) {
        try{
            log.debug({title: "Context -- POST", details: context});
            if(context.method == 'CreateAgreement'){
                if(context.data && context.data != null){
                    var agreementResponse;
                    if(context.data.length > 0){
                        for(var a = 0; a < context.data.length; a++){
                            agreementResponse = createAgreement(context.data[a]);
                            if(agreementResponse.isValid == true){
                                postResponse.success.push(agreementResponse);
                            }
                            else {
                                postResponse.fail.push(agreementResponse);
                            }
                        }
                    }
                    else{
                        postResponse.fail.push({
                            isValid : false,
                            message: "Agreement data empty.",
                            data: null
                        });
                    }
                    response = postResponse;
                }
            }
            if(context.method == 'CreateAgreementLines'){
                log.debug({title: "method=CreateAgreementLines"});
                if(context.data && context.data != null){
                    if(context.data.length > 0){
                        var lineResponse;
                        log.debug({title: "Line Count", details: context.data.length});
                        for(var i = 0; i < context.data.length; i++){
                            lineResponse  =  createAgreementLines(context.data[i]);
                            if(lineResponse.isValid == true){
                                postResponse.success.push(lineResponse);
                            }
                            else {
                                postResponse.fail.push(lineResponse);
                            }
                            response = postResponse;
                        }
                    }
                }
            }
            if(context.method == 'CreateAgreementWithLines'){
                if(context.data && context.data != null){
                    if(context.data && context.data != null){
                        var agreementResponse, lineResponse;
                        if(context.data.length > 0){
                            if(context.data.lines.length > 0){
                                agreementResponse = createAgreement(context.data);
                                if(agreementResponse.isValid == true && agreementResponse.data != null){
                                    postResponse.success.push(agreementResponse);
                                    for(var l = 0; l < context.data.lines.length; l++){
                                        context.data.lines[l].agreement = agreementResponse.data;
                                        lineResponse  =  createAgreementLines(context.data.lines[l]);
                                        if(lineResponse.isValid == true){
                                            postResponse.success.push(lineResponse);
                                        }
                                        else {
                                            postResponse.fail.push(lineResponse);
                                        }
                                    }
                                }
                                else {
                                    postResponse.fail.push(agreementResponse);
                                }
                            }
                            else{
                                postResponse.fail = {
                                    isValid : false,
                                    messagae : "No agreement line found in the request data.",
                                    data : null
                                } 
                            }
                            response = postResponse;
                        }
                        else{
                            postResponse.fail = {
                                isValid : false,
                                messagae : "No agreement data found in the request.",
                                data : null
                            }
                        }
                    }
                }
            }
            if(context.method == 'CreateAgreementConclusion'){
                if(context.data && context.data != null){
                    createAgreementConclustion(context.data);
                }
            }
            if(context.method == 'CreateOrUpdateAgreementLines'){//For internal scripting.
                log.debug({title: "method=CreateOrUpdateAgreementLines"});
                if(context.data && context.data != null){
                    if(context.data.length > 0){
                        var lineResponse;
                        log.debug({title: "Line Count", details: context.data.length});
                        for(var i = 0; i < context.data.length; i++){
                            if(context.data[i].id){
                                lineResponse  =  updateAgreementLines(context.data[i]);
                            }
                            else{
                                lineResponse  =  createAgreementLines(context.data[i]);
                            }
                            if(lineResponse.isValid == true){
                                // For scripting requirements
                                var id = lineResponse.data;
                                context.data[i].id = id.toString();
                                lineResponse["id"] = id.toString();
                                lineResponse["data"] = [];
                                lineResponse["data"].push(context.data[i]);
                                postResponse.success.push(lineResponse);
                            }
                            else {
                                postResponse.fail.push(lineResponse);
                            }
                            response = postResponse;
                        }
                    }
                }
            }
            if(context.method == 'CreateOrUpdateCompleteAgreement'){//For internal scripting.
                log.debug({title: "method=CreateOrUpdateCompleteAgreement"});
                if(context.data && context.data != null ){
                    if(context.data.lines && context.data.lines.length > 0){
                        var agreementResponse = null;
                        if(isEmpty(context.data.id)){
                            agreementResponse = createAgreement(context.data);
                        }
                        else{
                            agreementResponse = updateAgreement(context.data);
                        }
                        log.debug({title: "Agreement response", details: agreementResponse});
                        if(agreementResponse.isValid == true && agreementResponse.data){
                            var lineResponse;
                            for(var x = 0; x < context.data.lines.length; x++){
                                context.data.lines[x].agreement = agreementResponse.data;
                                if(context.data.lines[x].id){
                                    updateAgreementLines(context.data.lines[x]);
                                }
                                else{
                                    createAgreementLines(context.data.lines[x]);
                                }
                            }
                            var agreementURL =  url.resolveRecord({
                                recordType: "customrecord_ps_agreement",
                                recordId: agreementResponse.data,
                                isEditMode: false
                            });
                            response = {
                                isValid: true,
                                message: "Agreement and lines successfully saved.",
                                url: agreementURL
                            }
                        }
                        else{
                            response = {
                                isValid : false,
                                message : agreementResponse.message
                            } 
                        }
                    }
                    else{
                        response = {
                            isValid : false,
                            message : "Agreement detail lines data is not valid."
                        } 
                    }
                }
                else{
                    response = {
                        isValid : false,
                        message : "Something went wrong. Agreement data is not valid."
                    }  
                }
            }
        }
        catch(error){
            log.debug({title: "Error | triggerAPIPostEvent", details: JSON.stringify(error)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again."
            }
        }
        log.debug({title: "Request End"});
        return JSON.stringify(response);
    }
    function triggerAPIPutEvent(context) {
        try{
            log.debug({title: "Context -- PUT", details: context});
            if(context.method == 'UpdateAgreement'){
                if(context.data && context.data != null){
                    var agreementResponse;
                    if(context.data.length > 0){
                        for(var a = 0; a < context.data.length; a++){
                            agreementResponse = updateAgreement(context.data[a]);
                            if(agreementResponse.isValid == true){
                                postResponse.success.push(agreementResponse);
                            }
                            else {
                                postResponse.fail.push(agreementResponse);
                            }
                        }
                    }
                    else{
                        postResponse.fail.push({
                            isValid : false,
                            message: "Agreement data empty.",
                            data: null
                        });
                    }
                    response = postResponse;
                }
            }
            if(context.method == 'UpdateAgreementLines'){
                if(context.data && context.data != null){
                    if(context.data.length > 0){
                        var lineResponse;
                        for(var i = 0; i < context.data.length; i++){
                            lineResponse  =  updateAgreementLines(context.data[i]);
                            if(lineResponse.isValid == true){
                                postResponse.success.push(lineResponse);
                            }
                            else {
                                postResponse.fail.push(lineResponse);
                            }
                            response = postResponse;
                        }
                    }
                    else{
                        postResponse.fail.push({
                            isValid : false,
                            message: "Agreement lines data empty.",
                            data: null
                        });
                    }
                }
            }
        }
        catch(error){
            log.debug({title: "Error | triggerAPIPutEvent", details: JSON.stringify(error)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again."
            }
        }
        log.debug({title: "Request End"});
        return response;
    }
    /***************************
    * Private Functions
    ****************************/
    function getAgreements(requestFilters){
        try{
            var srchFilters = null;
            var agreementList = [];
            if(requestFilters && requestFilters != null){
                srchFilters = [];
                if(requestFilters.id){
                    srchFilters.push(["internalid","anyof", requestFilters.id]);
                    srchFilters.push("AND");
                }
                if(requestFilters.customer){
                    srchFilters.push(["formulanumeric: CASE WHEN {custrecord_ps_a_customer} = "+requestFilters.customer+" THEN 1 ELSE 0 END","equalto","1"]);
                    srchFilters.push("AND");
                }
                if(requestFilters.subsidiary){
                    srchFilters.push(["custrecord_ps_a_subsidiary.name","is", requestFilters.subsidiary]);
                    srchFilters.push("AND");
                }
                if(requestFilters.status){
                    srchFilters.push(["custrecord_ps_a_status","is", requestFilters.status]);
                    srchFilters.push("AND");
                }
                if(requestFilters.startDate && requestFilters.endDate){
                    srchFilters.push(["custrecord_ps_a_agreement_start","on", requestFilters.startDate]);
                    srchFilters.push("AND");
                    srchFilters.push(["custrecord_ps_a_agreement_end_date","on", requestFilters.endDate]);
                    srchFilters.push("AND");
                }
                else if(requestFilters.startDate){
                    srchFilters.push(["custrecord_ps_a_agreement_start","on", requestFilters.startDate]);
                    srchFilters.push("AND");
                }
                else if(requestFilters.endDate){
                    srchFilters.push(["custrecord_ps_a_agreement_end_date","on", requestFilters.endDate]);
                    srchFilters.push("AND");
                }
                srchFilters.push(["isinactive", "is", "F"]);
            }
            else{
                srchFilters = [];
                srchFilters.push(["isinactive", "is", "F"]); 
            }
            var agreementSrch = search.create({
                type: "customrecord_ps_agreement",
                filters: srchFilters,
                columns:
                [
                   search.createColumn({name: "internalid", summary: "GROUP", label: "Id"}),
                   search.createColumn({name: "custrecord_ps_a_customer", summary: "MAX", label: "Customer"}),
                   search.createColumn({name: "custrecord_ps_a_subsidiary", summary: "MAX", label: "Subsidiary"}),
                   search.createColumn({name: "custrecord_ps_a_currency", summary: "MAX", label: "Currency"}),
                   search.createColumn({name: "custrecord_ps_a_agreement_start", summary: "MAX", label: "Start Date"}),
                   search.createColumn({name: "custrecord_ps_a_agreement_end_date", summary: "MAX", label: "End Date"}),
                   search.createColumn({name: "custrecord_ps_a_contract_term", summary: "MAX", label: "Term"}),
                   search.createColumn({name: "custrecord_ps_a_payment_method", summary: "MAX", label: "Payment Method"}),
                   search.createColumn({name: "custrecord_ps_a_required_monthly_min",summary: "MAX",label: "Required Minimum"}),
                   search.createColumn({name: "created", summary: "MAX", label: "Date Created"}),
                   search.createColumn({name: "custrecord_ps_a_evergreen", summary: "MAX", label: "Evergreen"}),
                   search.createColumn({name: "custrecord_ps_a_status", summary: "MAX", label: "Status"}),
                   search.createColumn({
                        name: "formulatext",
                        summary: "MAX",
                        formula: "'['||ns_concat( distinct '{\"id\":\"'||{custbody_ps_agreement.internalid}||'\",\"type\":\"'||{custbody_ps_agreement.type}||'\",\"documentNumber\":\"'||{custbody_ps_agreement.number}||'\",\"date\":\"'||{custbody_ps_agreement.trandate}||'\"}')||']'",
                        label: "Transaction Data"
                   }),
                   search.createColumn({
                        name: "formulatext",
                        summary: "MAX",
                        formula: "'['||ns_concat(distinct '{\"id\":\"'||{custrecord_ps_aad_agreement.internalid}||'\",\"item\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_item}||'\",\"quantity\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_quantity}||'\",\"amount\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_amount}||'\",\"requiredMinimum\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_required_minimum}||'\",\"startDate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_start_date}||'\",\"endDate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_end_date}||'\",\"nextBillingDate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_next_billing_date}||'\",\"renewalDate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_next_renewal_date}||'\",\"lastBillingDate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_last_billing_date}||'\",\"status\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_status}||'\",\"agreementLineType\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_agreement_type}||'\",\"priceLevel\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_price_level}||'\",\"agreementPricingType\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_pricing_type}||'\",\"createdFromTransactionId\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_created_from}||'\",\"transactionLineUniqueKey\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_tran_line_key}||'\",\"rate\":\"'||{custrecord_ps_aad_agreement.custrecord_ps_aad_rate}||'\"}')||']'",
                        label: "Agreement Line"
                   }),
                   search.createColumn({
                        name: "formulatext",
                        summary: "MAX",
                        formula: "'['||ns_concat( distinct '{\"id\":\"'||{custrecord_ps_ac_agreement.internalid}||'\",\"agreement\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_agreement}||'\",\"agreementLineId\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_as_agreement_detail}||'\",\"renewedAgreement\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_renewed_agreement}||'\",\"event\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_concluding_event}||'\",\"effectiveDate\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_effective_date}||'\",\"reason\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_concluding_event_reason}||'\"}')||']'",
                        label: "Conclusion Event"
                   })
                ]
            });
            var transactionList, detailLineList, conclusionList;
            agreementSrch.run().each(function(result){
                //log.debug({title: "JSON string", details: result.getValue(result.columns[13])});
                transactionList = result.getValue(result.columns[12])? JSON.parse(result.getValue(result.columns[12])) : [];
                detailLineList = result.getValue(result.columns[13])? JSON.parse(result.getValue(result.columns[13])) : [];
                conclusionList = result.getValue(result.columns[14])? JSON.parse(result.getValue(result.columns[14])) : [];
                if(transactionList && transactionList.length > 0){
                    if(isEmpty(transactionList[0].id)){
                        transactionList = [];
                    }
                }
                if(detailLineList && detailLineList.length > 0){
                    if(isEmpty(detailLineList[0].id)){
                        detailLineList = [];
                    }
                }
                if(conclusionList && conclusionList.length > 0){
                    if(isEmpty(conclusionList[0].id)){
                        conclusionList = [];
                    }
                }
                agreementList.push({
                    id : result.getValue({name: "internalid", summary: "GROUP", label: "Id"}),
                    customer : result.getValue({name: "custrecord_ps_a_customer", summary: "MAX", label: "Customer"}),
                    subsidiary : result.getValue({name: "custrecord_ps_a_subsidiary", summary: "MAX", label: "Subsidiary"}),
                    currency : result.getValue({name: "custrecord_ps_a_currency", summary: "MAX", label: "Currency"}),
                    startDate: result.getValue({name: "custrecord_ps_a_agreement_start", summary: "MAX", label: "Start Date"}),
                    endDate: result.getValue({name: "custrecord_ps_a_agreement_end_date", summary: "MAX", label: "End Date"}),
                    term: result.getValue({name: "custrecord_ps_a_contract_term", summary: "MAX", label: "Term"}),
                    paymentMethod: result.getValue({name: "custrecord_ps_a_payment_method", summary: "MAX", label: "Payment Method"}),
                    requiredMinimum: result.getValue({name: "custrecord_ps_a_required_monthly_min",summary: "MAX",label: "Required Minimum"}),
                    createdDate: result.getValue({name: "created", summary: "MAX", label: "Date Created"}),
                    isEvergreen: result.getValue({name: "custrecord_ps_a_evergreen", summary: "MAX", label: "Evergreen"}),
                    status: result.getValue({name: "custrecord_ps_a_status", summary: "MAX", label: "Status"}),
                    lines : detailLineList,
                    conclusionEvents : conclusionList,
                    transactions : transactionList,
                });
                return true;
            });
            response = {
                isValid : true,
                messagae : null,
                data : agreementList
            }
        }
        catch(exp){
            log.error({title: "Error while fetching agreement data. | getAgreements", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
    }
    function createAgreement(objAgreement) {
        try{
            if(objAgreement && objAgreement != null){
                response = validateAgreementInput(objAgreement);
                if(response.isValid == true){
                    var currentDate = moment();
                    var newAgreementRec = record.create({
                        type: 'customrecord_ps_agreement',
                        isDynamic: true,
                    });
                    if(objAgreement.customerId){
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_customer', value: objAgreement.customerId });
                    }
                    else if(objAgreement.customer){
                        newAgreementRec.setText({ fieldId: 'custrecord_ps_a_customer', text: objAgreement.customer });
                    }
                    if(objAgreement.subsidiaryId){
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_subsidiary', value: objAgreement.subsidiaryId });
                    }
                    else if(objAgreement.subsidiary){
                        newAgreementRec.setText({ fieldId: 'custrecord_ps_a_subsidiary', text: objAgreement.subsidiary });
                    }
                    if(objAgreement.term){
                        newAgreementRec.setText({ fieldId: 'custrecord_ps_a_contract_term', text: objAgreement.term });
                    }
                    if(objAgreement.paymentMethod){
                        newAgreementRec.setText({ fieldId: 'custrecord_ps_a_payment_method', text: objAgreement.paymentMethod });
                    }
                    if(!isEmpty(objAgreement.currency)){
                        newAgreementRec.setText({ fieldId: 'custrecord_ps_a_currency', text: objAgreement.currency });
                    }
                    if(!isEmpty(objAgreement.requiredMinimum)){
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_required_monthly_min', value: objAgreement.requiredMinimum});
                    }
                    if(!isEmpty(objAgreement.startDate)){
                        log.debug({ title: "Agreement Start Date", details : objAgreement.startDate });
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_start', value: format.parse({value: objAgreement.startDate , type: format.Type.DATE}) });
                    }
                    if(!isEmpty(objAgreement.endDate)){
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_end_date', value: format.parse({value: objAgreement.endDate , type: format.Type.DATE}) });
                    }
                    else{
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_evergreen', value: true });
                    }
                    if(moment(objAgreement.startDate).isSameOrBefore(currentDate)){
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '2' });
                    }
                    else{
                        newAgreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '1' }); 
                    }
                    var newAgreementId = newAgreementRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    response = {
                        isValid : true,
                        message: "Agreement successfully created.",
                        data: newAgreementId
                    }
                }
                else{
                    response = {
                        isValid : false,
                        message: "Agreement data is not valid. Missing required field values.",
                        data: null
                    }
                }
            }
        }
        catch(exp){
            log.error({title: "Error while creating agreement. | createAgreement", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
    }
    function createAgreementLines(objAgreementLine){
        try{
            if(objAgreementLine && objAgreementLine != null){
                response = validateAgreementLineInput(objAgreementLine);
                if(response.isValid == true){
                    var newAgreementDetailRec = record.create({
                        type: 'customrecord_ps_agreement_details',
                        isDynamic: true,
                    });
                    if(objAgreementLine.agreement){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement', value: objAgreementLine.agreement });
                    }
                    if(objAgreementLine.itemId){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_item', value: objAgreementLine.itemId });
                    }
                    else if(objAgreementLine.item){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_item', text: objAgreementLine.item });
                    }
                    if(objAgreementLine.quantity){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_quantity', value: objAgreementLine.quantity });
                    }
                    if(!isEmpty(objAgreementLine.priceLevelId)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_price_level', value: objAgreementLine.priceLevelId});
                    }
                    else if(!isEmpty(objAgreementLine.priceLevel)){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_price_level', text: objAgreementLine.priceLevel});
                    }
                    else if(objAgreementLine.rate){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_rate', value: objAgreementLine.rate });
                    }
                    if(objAgreementLine.billingFrequency){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_billing_frequency', text: objAgreementLine.billingFrequency });
                    }
                    if(objAgreementLine.createdFromTransactionId){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_created_from', value: objAgreementLine.createdFromTransactionId });
                    }
                    if(objAgreementLine.transactionLineUniqueKey){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_tran_line_key', value: objAgreementLine.transactionLineUniqueKey });
                    }
                    newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_amount', value: parseFloat(objAgreementLine.quantity|0)*parseFloat(objAgreementLine.rate|0) });
                    if(objAgreementLine.agreementPricingType){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_pricing_type', text: objAgreementLine.agreementPricingType});
                    }
                    if(objAgreementLine.agreementLineType){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_agreement_type', text: objAgreementLine.agreementLineType});
                    }
                    if(objAgreementLine.requiredMinimum){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_required_minimum', value: objAgreementLine.requiredMinimum});
                    }
                    if(!isEmpty(objAgreementLine.startDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_start_date', value: format.parse({value: objAgreementLine.startDate, type: format.Type.DATE}) });
                    }
                    if(!isEmpty(objAgreementLine.endDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_end_date', value: format.parse({value: objAgreementLine.endDate, type: format.Type.DATE}) });
                        // var nextRenewalDate = moment(objAgreementLine.endDate).add(1, 'days');
                        // newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_renewal_date', value: format.parse({value: nextRenewalDate, type: format.Type.DATE}) });   
                    }
                    if(!isEmpty(objAgreementLine.nextRenewalDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_renewal_date', value: format.parse({value: objAgreementLine.nextRenewalDate, type: format.Type.DATE}) });   
                    }
                    if(!isEmpty(objAgreementLine.lastBillingDate)){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_last_billing_date', value: format.parse({value: objAgreementLine.lastBillingDate, type: format.Type.DATE}) });   
                    }
                    if(objAgreementLine.status){
                        newAgreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_status', text: objAgreementLine.status});
                    }
                    else if(moment(objAgreementLine.startDate).isSameOrBefore(moment())){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '2'});
                    }
                    else{
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '1'});
                    }
                    if(objAgreementLine.nextBillingDate){
                        if(objAgreementLine.endDate){
                            if(moment(objAgreementLine.nextBillingDate).isSameOrBefore(moment(objAgreementLine.endDate))){
                                newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_billing_date', value: format.parse({value: objAgreementLine.nextBillingDate, type: format.Type.DATE}) });
                            }
                        }
                        else{
                            newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_billing_date', value: format.parse({value: objAgreementLine.nextBillingDate, type: format.Type.DATE}) });
                        }
                    }
                    if(objAgreementLine.usageGroup){
                        newAgreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_usage_group', value: objAgreementLine.usageGroup}); 
                    }
                    var newAgreementDetailId = newAgreementDetailRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    var newLineData = [];
                    objAgreementLine.id = newAgreementDetailId;
                    newLineData.push(objAgreementLine);
                    response = {
                        isValid : true,
                        message: "Agreement line successfully created.",
                        data: newAgreementDetailId
                    }
                }
            }
        }
        catch(exp){
            log.error({title: "Error while creating agreement line. | createAgreementLines", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
        
    }
    function updateAgreement(objAgreement) {
        try{
            if(objAgreement && objAgreement != null){
                if(objAgreement.id){
                    var currentDate = moment();
                    var agreementRec = record.load({
                        type: 'customrecord_ps_agreement',
                        id: objAgreement.id,
                        isDynamic: true,
                    });
                    if(objAgreement.customerId){
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_customer', value: objAgreement.customerId });
                    }
                    else if(objAgreement.customer){
                        agreementRec.setText({ fieldId: 'custrecord_ps_a_customer', text: objAgreement.customer });
                    }
                    if(objAgreement.subsidiaryId){
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_subsidiary', value: objAgreement.subsidiaryId });
                    }
                    else if(objAgreement.subsidiary){
                        agreementRec.setText({ fieldId: 'custrecord_ps_a_subsidiary', text: objAgreement.subsidiary });
                    }
                    if(objAgreement.term){
                        agreementRec.setText({ fieldId: 'custrecord_ps_a_contract_term', text: objAgreement.term });
                    }
                    if(objAgreement.paymentMethod){
                        agreementRec.setText({ fieldId: 'custrecord_ps_a_payment_method', text: objAgreement.paymentMethod });
                        log.debug({title: "Payment Method", details: objAgreement.paymentMethod});
                    }
                    if(!isEmpty(objAgreement.currency)){
                        agreementRec.setText({ fieldId: 'custrecord_ps_a_currency', text: objAgreement.currency });
                    }
                    if(!isEmpty(objAgreement.requiredMinimum)){
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_required_monthly_min', value: objAgreement.requiredMinimum});
                    }
                    if(!isEmpty(objAgreement.startDate)){
                        log.debug({ title: "Agreement Start Date", details : objAgreement.startDate });
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_start', value: format.parse({value: objAgreement.startDate , type: format.Type.DATE}) });
                    }
                    if(!isEmpty(objAgreement.endDate)){
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_agreement_end_date', value: format.parse({value: objAgreement.endDate , type: format.Type.DATE}) });
                    }
                    else{
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_evergreen', value: true });
                    }
                    if(moment(objAgreement.startDate).isSameOrBefore(currentDate)){
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '2' });
                    }
                    else{
                        agreementRec.setValue({ fieldId: 'custrecord_ps_a_status', value: '1' }); 
                    }
                    var agreementId = agreementRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    response = {
                        isValid : true,
                        message: "Agreement updated successfully.",
                        data: agreementId
                    }
                }
            }
        }
        catch(exp){
            log.error({title: "Error while updating agreement. | updateAgreement", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
    }
    function updateAgreementLines(objAgreementLine){
        try{
            if(objAgreementLine && objAgreementLine != null){
                if(objAgreementLine.id){
                    var agreementDetailRec = record.load({
                        type: 'customrecord_ps_agreement_details',
                        id: objAgreementLine.id,
                        isDynamic: true,
                    });
                    if(objAgreementLine.agreement){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_agreement', value: objAgreementLine.agreement });
                    }
                    if(objAgreementLine.itemId){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_item', value: objAgreementLine.itemId });
                    }
                    else if(objAgreementLine.item){
                        agreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_item', text: objAgreementLine.item });
                    }
                    if(objAgreementLine.quantity){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_quantity', value: objAgreementLine.quantity });
                    }
                    if(!isEmpty(objAgreementLine.priceLevelId)){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_price_level', value: objAgreementLine.priceLevelId});
                    }
                    else if(!isEmpty(objAgreementLine.priceLevel)){
                        agreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_price_level', text: objAgreementLine.priceLevel});
                    }
                    else if(objAgreementLine.rate){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_rate', value: objAgreementLine.rate });
                    }
                    if(objAgreementLine.billingFrequency){
                        agreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_billing_frequency', text: objAgreementLine.billingFrequency });
                    }
                    if(objAgreementLine.createdFromTransactionId){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_created_from', value: objAgreementLine.createdFromTransactionId });
                    }
                    if(objAgreementLine.transactionLineUniqueKey){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_tran_line_key', value: objAgreementLine.transactionLineUniqueKey });
                    }
                    if(objAgreementLine.quantity && objAgreementLine.rate){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_amount', value: parseFloat(objAgreementLine.quantity|0)*parseFloat(objAgreementLine.rate|0) });
                    }
                    if(objAgreementLine.agreementPricingType){
                        agreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_pricing_type', text: objAgreementLine.agreementPricingType});
                    }
                    if(objAgreementLine.agreementLineType){
                        agreementDetailRec.setText({ fieldId: 'custrecord_ps_aad_agreement_type', text: objAgreementLine.agreementLineType});
                    }
                    if(objAgreementLine.requiredMinimum){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_required_minimum', value: objAgreementLine.requiredMinimum});
                    }
                    if(objAgreementLine.startDate){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_start_date', value: format.parse({value: objAgreementLine.startDate, type: format.Type.DATE}) });
                    }
                    if(!isEmpty(objAgreementLine.endDate)){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_end_date', value: format.parse({value: objAgreementLine.endDate, type: format.Type.DATE}) });
                        // var nextRenewalDate = moment(objAgreementLine.endDate).add(1, 'days');
                        // agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_renewal_date', value: format.parse({value: nextRenewalDate, type: format.Type.DATE}) });   
                    }
                    if(!isEmpty(objAgreementLine.nextRenewalDate)){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_renewal_date', value: format.parse({value: objAgreementLine.nextRenewalDate, type: format.Type.DATE}) });   
                    }
                    if(!isEmpty(objAgreementLine.lastBillingDate)){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_last_billing_date', value: format.parse({value: objAgreementLine.lastBillingDate, type: format.Type.DATE}) });   
                    }
                    if(objAgreementLine.nextBillingDate){
                        if(objAgreementLine.endDate){
                            if(moment(objAgreementLine.nextBillingDate).isSameOrBefore(moment(objAgreementLine.endDate))){
                                agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_billing_date', value: format.parse({value: objAgreementLine.nextBillingDate, type: format.Type.DATE}) });
                            }
                        }
                        else{
                            agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_next_billing_date', value: format.parse({value: objAgreementLine.nextBillingDate, type: format.Type.DATE}) });
                        }
                    }
                    if(objAgreementLine.isClosed == true){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '3'});
                    }
                    else if(moment(objAgreementLine.startDate).isSameOrBefore(moment())){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '2'});
                    }
                    else{
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_status', value: '1'});
                    }
                    if(objAgreementLine.usageGroup){
                        agreementDetailRec.setValue({ fieldId: 'custrecord_ps_aad_usage_group', value: objAgreementLine.usageGroup}); 
                    }
                    var newAgreementDetailId = agreementDetailRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    response = {
                        isValid : true,
                        message: "Agreement line updated successfully.",
                        data: newAgreementDetailId
                    }
                }
            }
        }
        catch(exp){
            log.error({title: "Error while updating agreement line. | upadteAgreementLines", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
        
    }
    function createAgreementConclustion(objConclusion){
        try{
            if(objConclusion && objConclusion != null){
                response = validateAgreementConclustionInput(objConclusion);
                if(response.isValid == true){
                    var newAgreementConclusionRec = record.create({
                        type: 'customrecord_ps_agreement_conculsion',
                        isDynamic: true,
                    });
                    if(objConclusion.agreement){
                        newAgreementConclusionRec.setValue({fieldId: 'custrecord_ps_ac_agreement', value: objConclusion.agreement});
                    }
                    if(objConclusion.agreementLineId){
                        newAgreementConclusionRec.setValue({fieldId: 'custrecord_ps_as_agreement_detail', value: objConclusion.agreementLineId}); 
                    }
                    if(objConclusion.effectiveDate){
                        newAgreementConclusionRec.setValue({fieldId: 'custrecord_ps_ac_effective_date', value: objConclusion.effectiveDate});
                    }
                    if(objConclusion.event){
                        newAgreementConclusionRec.setText({fieldId: 'custrecord_ps_ac_concluding_event', text: objConclusion.event}); 
                    }
                    if(objConclusion.renewedAgreement){
                        newAgreementConclusionRec.setValue({fieldId: 'custrecord_ps_renewed_agreement', value: objConclusion.renewedAgreement}); 
                    }
                    if(objConclusion.reason){
                        newAgreementConclusionRec.setText({fieldId: 'custrecord_ps_concluding_event_reason', text: objConclusion.reason});
                    }
                    var newAgreementConclusionId = newAgreementConclusionRec.save({ enableSourcing: true, ignoreMandatoryFields: false });
                    response = {
                        isValid : true,
                        message: "Agreement conclusion successfully created.",
                        data: newAgreementConclusionId
                    }
                }
            }
        }
        catch(exp){
            log.error({title: "Error while creating agreement conclusion. | createAgreementConclustion", details: JSON.stringify(exp)});
            response = {
                isValid : false,
                message: "Unexpected server error! Please try again.",
                data: null
            }
        }
        return response;
    }
    function validateAgreementInput(objAgreement){
        var result = {
            isValid : true,
            message : "Missing Required data.",
            data : {
                id : objAgreement.id
            }
        }
        if(objAgreement){
            if(isEmpty(objAgreement.customer)){
                result = {
                    isValid : false,
                    message : result.message + "\nCustomer is missing."
                }
            }
            if(isEmpty(objAgreement.subsidiary)){
                result = {
                    isValid : false,
                    message : result.message + "\nSubsidiary is missing."
                }
            }
            if(isEmpty(objAgreement.term)){
                result = {
                    isValid : false,
                    message : result.message + "\nContract term is missing."
                }
            }
            if(isEmpty(objAgreement.startDate)){
                result = {
                    isValid : false,
                    message : result.message + "\nAgreement start date is missing."
                }
            }
        }
        else{
            result = {
                isValid : false,
                message : "Required data for agreement is missing."
            }
        }
        return result;
    }
    function validateAgreementLineInput(objAgreementLine){
        var result = {
            isValid : true,
            message : "Missing Required data.",
            data : {
                id : objAgreementLine.id
            }
        }
        if(objAgreementLine){
            if(isEmpty(objAgreementLine.agreement)){
                result = {
                    isValid : false,
                    message : result.message + "\nAgreement is missing."
                }
            }
            if(isEmpty(objAgreementLine.item)){
                result = {
                    isValid : false,
                    message : result.message + "\nItem is missing."
                }
            }
            if(isEmpty(objAgreementLine.quantity)){
                result = {
                    isValid : false,
                    message : result.message + "\nQuantity is missing."
                }
            }
            if(isEmpty(objAgreementLine.rate) && isEmpty(objAgreementLine.priceLevel)){
                result = {
                    isValid : false,
                    message : result.message + "\nRate/Price level is missing."
                }
            }
            if(isEmpty(objAgreementLine.startDate)){
                result = {
                    isValid : false,
                    message : result.message + "\nStart date is missing."
                }
            }
            if(isEmpty(objAgreementLine.billingFrequency)){
                result = {
                    isValid : false,
                    message : result.message + "\nBilling frequency is missing."
                }
            }
        }
        else{
            result = {
                isValid : false,
                message : "Required data for agreement line is missing."
            }
        }
        return result;
    }
    function validateAgreementConclustionInput(objconclustion){
        var result = {
            isValid : true,
            message : "Missing Required data.",
            data : {
                id : objconclustion.id
            }
        }
        if(objAgreement){
            if(isEmpty(objAgreement.effectiveData)){
                result = {
                    isValid : false,
                    message : result.message + "\nEffective Date is missing."
                }
            }
            if(isEmpty(objAgreement.event)){
                result = {
                    isValid : false,
                    message : result.message + "\nEvent name is missing."
                }
            }
        }
        else{
            result = {
                isValid : false,
                message : "Required data for agreement conclusion is missing."
            }
        }
        return result;
    }
    function isEmpty(value) {
        if (value == "Invalid date" || value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
        return false;
    }

    return {
        get: triggerAPIGetEvent,
        put: triggerAPIPutEvent,
        post: triggerAPIPostEvent
    };
 });