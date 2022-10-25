/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/search', 'N/record', 'N/ui/serverWidget'], function(log, search, record, serverWidget) {
    function beforeLoad(context){
        try{
            var form = context.form;
            if(form){
                var createdFromFld = form.getField("custrecord_ps_aad_created_from");
                var lineKeyFld = form.getField("custrecord_ps_aad_tran_line_key");
                if(createdFromFld){
                    createdFromFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.INLINE
                    });
                }
                if(lineKeyFld){
                    lineKeyFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.INLINE
                    });
                }
            }
        }
        catch(error){
            log.error({ title : "Error on before load", details : JSON.stringify(error) });
        }
    }
    function afterSubmit(context) {
        if (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) {
            try{
                log.debug({ title: "Current Context", details : context.type });
                var currentRecId = context.newRecord.id;
                log.debug({ title: "Record Id", details: currentRecId });
                if(currentRecId){
                    var currentAgreementDetailRec =  record.load({
                        type: "customrecord_ps_agreement_details",
                        id: currentRecId,
                        isDynamic: false,
                    });
                    var priceLevel = currentAgreementDetailRec.getValue("custrecord_ps_aad_price_level");
                    var priceType = currentAgreementDetailRec.getValue("custrecord_ps_aad_pricing_type");
                    var billingFreq = currentAgreementDetailRec.getValue("custrecord_ps_aad_billing_frequency");
                    var qty = currentAgreementDetailRec.getValue("custrecord_ps_aad_quantity");
                    log.debug({ title: "Billing Freq | Qty | Price Level", details: billingFreq +" | "+ qty +" | "+ priceLevel});
                    if(billingFreq && qty && priceLevel){
                        var result = getRateAndAmount(priceLevel, billingFreq, qty, priceType);
                        log.debug({ title: "rate and amount result", details: JSON.stringify(result)});
                        if(result){
                            if(result.rate && result.rate != 0){
                                currentAgreementDetailRec.setValue({
                                    fieldId: 'custrecord_ps_aad_rate',
                                    value: result.rate,
                                });
                            }
                            if(result.amount && result.amount != 0){
                                currentAgreementDetailRec.setValue({
                                    fieldId: 'custrecord_ps_aad_amount',
                                    value: result.amount,
                                });
                            }
                        }
                        currentAgreementDetailRec.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
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

    return {
        afterSubmit: afterSubmit,
        beforeLoad : beforeLoad
    }
});