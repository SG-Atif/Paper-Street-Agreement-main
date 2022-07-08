/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

 define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format'],
function(log, search, record, moment, format) {
    function getInputData() {
        var agreementList = [];
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_next_billing_date","on","today"], 
               //["custrecord_ps_aad_agreement", "anyof", "5505"],
               "AND", 
               ["custrecord_ps_aad_status","anyof","3","2"],//Active & Cancelled
               "AND", 
               ["formulanumeric: CASE WHEN {custrecord_ps_aad_next_billing_date} = {custrecord_ps_aad_last_billing_date} THEN 1 ELSE 0 END","equalto","0"]
            ],
            columns:
            [
               search.createColumn({
                  name: "custrecord_ps_aad_agreement",
                  summary: "GROUP",
                  sort: search.Sort.ASC,
                  label: "Agreement"
               })
            ]
        });
        agreementSrch.run().each(function(result){
            agreementList.push(result.getValue({
                name: "custrecord_ps_aad_agreement",
                summary: "GROUP",
                sort: search.Sort.ASC,
                label: "Agreement"
            }));
            return true;
        });
        return agreementList;
    }

    function map(context) {
        try{
            if(context.value){
                var agreementId = JSON.parse(context.value);
                if(agreementId){ 
                    log.debug({title : "Agreement Id", details : agreementId});
                    var agreementDetailList = getAgreementDetailLines(agreementId);
                    if(agreementDetailList && agreementDetailList.length > 0){
                        log.debug({title : "Agreement Detail Data", details : agreementDetailList});
                        // Load agreement record
                        var agreementRec = record.load({
                                            type: 'customrecord_ps_agreement',
                                            id: agreementId
                                        });
                        var newInvoice = record.create({
                                type: "invoice", 
                                isDynamic: true,
                                defaultValues: {
                                    entity: agreementRec.getValue("custrecord_ps_a_customer")
                                }
                                        });
                        if(newInvoice){
                            newInvoice.setValue({fieldId : "subsidiary", value : agreementRec.getValue("custrecord_ps_a_subsidiary")});
                            newInvoice.setValue({fieldId : "custbody_ps_agreement", value : agreementId});
                            newInvoice.setValue({fieldId : "custbody_ps_agreement_term", value : agreementRec.getValue("custrecord_ps_a_contract_term")});
                            newInvoice.setValue({fieldId : "custbody_ps_create_new_agreement", value : true});
                            newInvoice.setValue({fieldId : "custbody_ps_agreement_payment_method", value : agreementRec.getValue("custrecord_ps_a_payment_method")});
                            newInvoice.setValue({fieldId : "currency", value : agreementRec.getValue("custrecord_ps_a_currency")});
                            for(var j = 0; j < agreementDetailList.length; j++){
                                newInvoice.selectNewLine({sublistId: 'item'});
                                newInvoice.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    value: agreementDetailList[j].item,
                                });
                                newInvoice.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ps_agreement_pricing',
                                    value: agreementDetailList[j].priceLevel,
                                });
                                newInvoice.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ps_agreement_type',
                                    value: agreementDetailList[j].agreementType,
                                });
                                newInvoice.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ps_required_minimum',
                                    value: agreementDetailList[j].requiredMinimum,
                                });
                                if(agreementDetailList[j].agreementType == "2"){//Usage line
                                    newInvoice = addUsageLine(newInvoice, agreementDetailList[j]);
                                }
                                else{//Subscription line
                                    newInvoice = addSubscriptionLine(newInvoice, agreementDetailList[j]);
                                }
                            }
                            var total = parseFloat(newInvoice.getValue("total")||0);
                            var requiredMin = parseFloat(agreementRec.getValue("custrecord_ps_a_required_monthly_min")||0);
                            var requiredMinItem = null;
                            var prefSrch = search.create({
                                type: "customrecord_ps_agreement_preferences",
                                filters:
                                [
                                   ["isinactive","is","F"], 
                                   "AND", 
                                   ["custrecord_ps_ap_subsidiary","anyof", agreementRec.getValue("custrecord_ps_a_subsidiary")]
                                ],
                                columns:
                                [
                                   search.createColumn({name: "internalid", label: "Internal ID"}),
                                   search.createColumn({name: "custrecord_ps_ap_req_min_adj_item", label: "Required Minimum Adjustment Item"})
                                ]
                             });
                             prefSrch.run().each(function(result){
                                requiredMinItem = result.getValue({name: "custrecord_ps_ap_req_min_adj_item", label: "Required Minimum Adjustment Item"});
                                return true;
                             });
                            log.debug({title : "Invoice total | Min Req | Adjustment Item", details : total +" | "+ requiredMin +" | "+ requiredMinItem});
                            if(requiredMinItem && requiredMin){
                                if(requiredMin > total){
                                    newInvoice = addMinimumAdjustmentLine(newInvoice, requiredMinItem, (requiredMin-total));
                                }
                            }
                            var newInvoiceId = newInvoice.save({
                                                enableSourcing: true,
                                                ignoreMandatoryFields: true
                                            });
                            log.debug({title : "Invoice Id", details : newInvoiceId});
                            if(newInvoiceId){
                                // Pass data to reduce, so it can update next billing date.
                                for(var c = 0; c < agreementDetailList.length; c++){
                                    context.write({
                                        key: agreementDetailList[c].id,
                                        value: agreementDetailList[c].id
                                    });
                                }
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
                setNextBillingDate(context.values[0]);
            }
        }
        catch(error){
            log.error({title: "Error in Reduce", details : error});
        }
    }

    /**********************
     * Helper Functions****
    **********************/
    function getAgreementDetailLines(agreementId){
        var agreementDetailList = [];
        var agreementDetailSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_next_billing_date","on","today"], 
               "AND", 
               ["custrecord_ps_aad_status","anyof","2", "3"], 
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
               search.createColumn({name: "custrecord_ps_ct_quantity",join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",label: "Quantity"}),
               search.createColumn({name: "custrecord_ps_ct_time",join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",label: "Time"})
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
                lastBillingDate : result.getValue({name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date"}),
                pricingType : result.getValue({name: "custrecord_ps_aad_pricing_type", label: "Pricing Type"}),
                priceLevel : result.getValue({name: "custrecord_ps_aad_price_level", label: "Price Level"}),
                createdFrom : result.getValue({name: "custrecord_ps_aad_created_from", label: "Created From"}),
                tranLineKey : result.getValue({name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key"}),
                agreementType : result.getValue({name: "custrecord_ps_aad_agreement_type", label: "Agreement Type"}),
                billingFreq : result.getValue({name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq"}),
                billingFreqQty : result.getValue({name: "custrecord_ps_ct_quantity",join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",label: "Quantity"}),
                billingFreqTime : result.getValue({name: "custrecord_ps_ct_time",join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY",label: "Time"}),
            });
            return true;
        });
        return agreementDetailList;
    }
    function addMinimumAdjustmentLine(invoice, item, amount){
        invoice.selectNewLine({sublistId: 'item'});
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: item,
        });
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'qty',
            value: 1,
        });
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: amount,
        });
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: amount,
        });
        invoice.commitLine({
            sublistId: 'item'
        });
        return invoice;
    }
    function addSubscriptionLine(invoice, lineData){
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: lineData.qty,
        });
        if(lineData.rate){
            var billingStartDate = lineData.startDate;
            if(lineData.lastBillingDate){
                billingStartDate = lineData.lastBillingDate
            }
            var currentRate = lineData.rate;
            if(lineData.status == "3"){
                var effectiveCancellationDate = getCancellationEffectiveDate(lineData.id);
                if(effectiveCancellationDate){
                    if(moment(billingStartDate).isBefore(moment(effectiveCancellationDate))){
                        currentRate = getProRate(lineData.rate, lineData.billingFreqQty, lineData.billingFreqTime, billingStartDate, effectiveCancellationDate);
                        if(currentRate){
                            currentRate = currentRate.toFixed(2);
                        }
                        log.debug({title : "New subscript line Pro rate", details : currentRate});
                    }
                    else{
                        return invoice;
                    }
                }
                else{
                    return invoice;
                }
            }
            if(currentRate){
                invoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: currentRate,//.toFixed(2)
                });
                var currentLineAmount = parseFloat(currentRate||0)*parseFloat(lineData.qty||0);//.toFixed(2)
                invoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    value: currentLineAmount,
                });
            }
            else{
                return invoice;
            }
        }
        if(lineData.requiredMinimum && parseFloat(lineData.requiredMinimum||0) > 0){
            if(currentLineAmount < parseFloat(lineData.requiredMinimum)){
                invoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    value: lineData.requiredMinimum,
                });
            }
        }
        invoice.commitLine({
            sublistId: 'item'
        });
        return invoice;
    }
    function addUsageLine(invoice, lineData){
        var usageStartDate = lineData.startDate;
        var usageEndDate = lineData.nextBillingDate;
        if(lineData.lastBillingDate){
            usageStartDate = lineData.lastBillingDate;
        }
        if(lineData.status == "3"){
            usageEndDate = null;
            var effectiveCancellationDate = getCancellationEffectiveDate(lineData.id);
            if(effectiveCancellationDate){
                if(moment(usageStartDate).isBefore(moment(effectiveCancellationDate))){
                    usageEndDate = effectiveCancellationDate;
                }
                else{
                    return invoice;
                }                
            }
        }
        if(usageEndDate){
            var usageQty = getUsageQty(lineData.id, lineData.item, usageStartDate, usageEndDate);
            log.debug({title : "Qty | Usage Start Date | Usage End Date", details : usageQty +" | "+ usageStartDate +" | "+ usageEndDate});
            if(usageQty > 0){
                invoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: usageQty,
                });
                var currentUsageRate = lineData.rate;
                var currentLineAmount = parseFloat(currentUsageRate||0)*usageQty;
                var response = getRateAndAmount(lineData.priceLevel, lineData.billingFreq, usageQty, lineData.pricingType);
                if(parseFloat(response.rate||0) > 0){
                    currentUsageRate = parseFloat(response.rate||0);
                    currentLineAmount = currentUsageRate*usageQty;
                }
                if(currentUsageRate){
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: currentUsageRate, //.toFixed(2),
                    });
                    
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: currentLineAmount,
                    });
                }
                if(lineData.requiredMinimum && parseFloat(lineData.requiredMinimum||0) > 0){
                    if(currentLineAmount < parseFloat(lineData.requiredMinimum)){
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: lineData.requiredMinimum,
                        });
                    }
                }
                invoice.commitLine({
                    sublistId: 'item'
                });
            }
        }
        
        return invoice;
    }
    function getUsageQty(agreementDetailid, itemId, startDate, endDate){
        var totalQty = 0;
        var usageQtySrch = search.create({
            type: "customrecord_ps_agreement_usage",
            filters:
            [
               ["custrecord_ps_au_agreement_detail","anyof", agreementDetailid], 
               "AND", 
               ["custrecord_ps_au_item","anyof", itemId], 
               "AND", 
               ["custrecord_ps_au_usage_date","within", startDate, endDate]
            ],
            columns:
            [
               search.createColumn({name: "custrecord_ps_au_usage_qty", summary: "SUM", label: "Usage Quantity"})
            ]
        });
        usageQtySrch.run().each(function(result){
            totalQty = result.getValue({name: "custrecord_ps_au_usage_qty", summary: "SUM", label: "Usage Quantity"});
            return true;
        });
        return totalQty;
    }
    function getRateAndAmount(priceLevel, billingFreq, qty, priceType){
        log.debug({title : "PriceType", details: priceType});       
        qty = parseFloat(qty);
        var response = {
            rate : 0,
            amount : 0
        };
        var lookResults = search.lookupFields({
            type: 'customrecord_ps_agreement_pricing',
            id: priceLevel,
            columns: ['custrecord_ps_req_agreement_pricing_type']
        });
        log.debug({title : "Lookup Price Type val", details : lookResults.custrecord_ps_req_agreement_pricing_type});
        if(lookResults.custrecord_ps_req_agreement_pricing_type && 
            lookResults.custrecord_ps_req_agreement_pricing_type.length > 0){
            priceType = lookResults.custrecord_ps_req_agreement_pricing_type;
        }
        log.debug({title : "PriceLevel | Billing Freq | Qty | PriceType", details: priceLevel+" | "+billingFreq+" | "+qty+" | "+priceType});
        if(isEmpty(priceType) || priceType == "2" || priceType == "3"){// Max Volume
            var maxVolPricingSearch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                [
                   ["custrecord_ps_ap_agreement_pricing","anyof", priceLevel], 
                   "AND", 
                   ["custrecord_ps_ap_billing_frequency","anyof", billingFreq], 
                   "AND", 
                   ["custrecord_ps_ap_min_qty","lessthanorequalto", qty], 
                   "AND", 
                   ["custrecord_ps_ap_max_qty","greaterthanorequalto", qty]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing"}),
                   search.createColumn({name: "custrecord_ps_ap_min_qty", label: "Min Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_max_qty", label: "Max Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency"}),
                   search.createColumn({name: "custrecord_ps_ap_rate", label: "Rate"}),
                   search.createColumn({name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type"})
                ]
            });
            maxVolPricingSearch.run().each(function(result){
                response = {
                    rate : result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}),
                    amount : parseFloat(result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}))*qty
                };
                return true;
            });
        }
        else if(priceType == "3"){//Max Tier Flat Rate
            var flatRatePricingSearch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                [
                   ["custrecord_ps_ap_agreement_pricing","anyof", priceLevel], 
                   "AND", 
                   ["custrecord_ps_ap_billing_frequency","anyof", billingFreq], 
                   "AND", 
                   ["custrecord_ps_ap_min_qty","lessthanorequalto", qty], 
                   "AND", 
                   ["custrecord_ps_ap_max_qty","greaterthanorequalto", qty]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing"}),
                   search.createColumn({name: "custrecord_ps_ap_min_qty", label: "Min Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_max_qty", label: "Max Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency"}),
                   search.createColumn({name: "custrecord_ps_ap_rate", label: "Rate"}),
                   search.createColumn({name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type"})
                ]
            });
            flatRatePricingSearch.run().each(function(result){
                response = {
                    rate : result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}),
                    amount : parseFloat(result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}))
                };
                return true;
            });
        }
        else if(priceType == "1" ){
            var perTierPriceSrch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                [
                   ["custrecord_ps_ap_agreement_pricing","anyof", priceLevel], 
                   "AND", 
                   ["custrecord_ps_ap_billing_frequency","anyof", billingFreq]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing"}),
                   search.createColumn({name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_max_qty", label: "Max Qty"}),
                   search.createColumn({name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency"}),
                   search.createColumn({name: "custrecord_ps_ap_rate", label: "Rate"}),
                   search.createColumn({name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type"})
                ]
             });
             var qtyCalculation = qty;
             var minQty;
             var maxQty;
             perTierPriceSrch.run().each(function(result){
                minQty = parseFloat(result.getValue({name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty"}));
                maxQty = parseFloat(result.getValue({name: "custrecord_ps_ap_max_qty", label: "Max Qty"}));
                if(minQty <= qty){
                    if(maxQty <= qty){
                        response.rate = parseFloat(result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}));
                        response.amount = response.amount + (maxQty*response.rate);
                    }
                    else{
                        response.rate = parseFloat(result.getValue({name: "custrecord_ps_ap_rate", label: "Rate"}));
                        qtyCalculation = qty - (minQty-1);
                        response.amount = response.amount + (qtyCalculation*response.rate);
                    }
                }
                return true;
             });
        }
        if(response && response.amount && response.rate){
            response.rate = parseFloat(response.amount)/qty;
        }
        return response;
    }
    function isEmpty(value) {
        if (value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
        return false;
    }
    function setNextBillingDate(ids){
        log.debug({title: "id", details: ids});
        var agreementNextBillSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
                ["internalid","anyof", ids],
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_agreement", label: "Agreement"}),
               search.createColumn({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
               search.createColumn({name: "custrecord_ps_aad_end_date", label: "End Date"}),
               search.createColumn({name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date"}),
               search.createColumn({name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency"}),
               search.createColumn({name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time"}),
               search.createColumn({name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity"}),
               search.createColumn({name: "custrecord_ps_aad_status", label: "Status"}),
            ]
        });
        agreementNextBillSrch.run().each(function(result){
            var data = {
                id : result.getValue({name: "internalid", label: "Internal ID"}),
                startDate : result.getValue({name: "custrecord_ps_aad_start_date", label: "Start Date"}),
                endDate : result.getValue({name: "custrecord_ps_aad_end_date", label: "End Date"}),
                nextBillingDate : result.getValue({name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date"}),
                billingFreq : result.getValue({name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency"}),
                billingFreqQty : result.getValue({name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity"}),
                billingFreqTime : result.getValue({name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time"}),
                status : result.getValue({name: "custrecord_ps_aad_status", label: "Status"})
            };
            log.debug({title: "Next Billing Date Data", details: data});
            if(data.status == "2"){ // Active
                if(data['billingFreqTime']){
                    data['billingFreqScriptid'] = getBillingFreqTimeScriptId(data['billingFreqTime']);
                }
                log.debug({ title : "Data detail", details : data});
                var newNextBillingDate = getNextBillingDate(data['startDate'], data['nextBillingDate'], data['billingFreqQty'], 
                                                            data['billingFreqScriptid'], data['endDate']);
                log.debug({ title : "New Next Billing Date", details : newNextBillingDate});
                if(newNextBillingDate){
                    updateAgreementDetail(data['id'], newNextBillingDate, data.nextBillingDate);
                }
            }
            else if(data.status == "3"){//Cancel
                updateAgreementDetail(data['id'], data.nextBillingDate, data.nextBillingDate);
            }
            return true;
        });
    }
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
            nextBillingDate = moment(startDate).add(qty, timeId);
            if(nextBillingDate){
                var current = moment();
                if(moment(nextBillingDate).isSameOrBefore(current)){
                    nextBillingDate = getNextBillingDate('', nextBillingDate, qty, timeId, endDate);
                }
            }
        }
        if(endDate){
            if(moment(nextBillingDate).isSameOrAfter(moment(endDate))){
                nextBillingDate = endDate;
            }
        }
        return nextBillingDate? moment(nextBillingDate).format('MM/DD/YYYY') : '';
    }
    function updateAgreementDetail(id, nextBillingDate, previousBillingDate){
        log.debug({title:"Next Billing Date", details:"Last Billing Date"});
        var currentDetailRec = record.load({
            type : 'customrecord_ps_agreement_details',
            id : id
        });
        currentDetailRec.setValue({
            fieldId: 'custrecord_ps_aad_next_billing_date',
            value: new Date(nextBillingDate),
        });
        currentDetailRec.setValue({
            fieldId: 'custrecord_ps_aad_last_billing_date',
            value: new Date(moment(previousBillingDate).format('MM/DD/YYYY')),
        });
        currentDetailRec.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });
    }
    function getProRate(rate, qty, time, startDate, endDate){
        var prorate = 0;
        var currentProRateDays = 0;
        if(startDate && endDate){
            currentProRateDays = Math.abs(moment(startDate).diff(moment(endDate), 'days'));
        }
        log.debug({title : "Current pro rate days", details : currentProRateDays});
        if(rate && qty && time){
            rate = parseFloat(rate||0);
            qty = parseFloat(qty|0);
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
        log.debug({title : "Pro rate per current days values", details : prorate*currentProRateDays});
        return prorate*currentProRateDays;
    }
    function getCancellationEffectiveDate(detailLineId){
        var effectiveDate = null;
        var cancellationSrch = search.create({
            type: "customrecord_ps_agreement_conculsion",
            filters:
            [
               ["custrecord_ps_ac_concluding_event","anyof","2"], 
               "AND", 
               ["custrecord_ps_as_agreement_detail","anyof", detailLineId]
            ],
            columns:
            [
               search.createColumn({
                  name: "custrecord_ps_as_agreement_detail",
                  summary: "GROUP",
                  label: "Agreement Detail"
               }),
               search.createColumn({
                  name: "custrecord_ps_ac_effective_date",
                  summary: "MAX",
                  label: "Effective Date"
               })
            ]
        });
        cancellationSrch.run().each(function(result){
            effectiveDate = result.getValue({
                name: "custrecord_ps_ac_effective_date",
                summary: "MAX",
                label: "Effective Date"
             });
        });
        return effectiveDate;
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };
});