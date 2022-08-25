/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/log', 'N/search', 'N/record', './moment.min.js'], function (log, search, record, moment) {
    function getInputData() {
        var data = [];
        var preferencesSearch = search.create({
            type: "customrecord_ps_agreement_preferences",
            filters:
                [
                    ["isinactive", "is", "F"]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_ps_ap_subsidiary", label: "Subsidiary" }),
                    search.createColumn({ name: "custrecord_ps_ap_agr_bill_sched_cre_adv", label: "Billing Schedule Advance Days" }),
                ]
        });
        preferencesSearch.run().each(function (currentPref) {
            var lineData = getAgreementDetailLines(currentPref.getValue({ name: "custrecord_ps_ap_subsidiary", label: "Subsidiary" }),
                currentPref.getValue({ name: "custrecord_ps_ap_agr_bill_sched_cre_adv", label: "Billing Schedule Advance Days" }));
            if (lineData && lineData.length > 0) {
                data = data.concat(lineData);
            }
            return true;
        });
        return data;
    }

    function map(context) {
        try {
            if (context.value) {
                var srchData = JSON.parse(context.value);
                log.debug({ title: "Current Data", details: srchData });
                var parentBillingRecId = getAgreementBillingParent();
                if (isEmpty(parentBillingRecId)) {
                    var newParentRecId = record.create({
                        type: "customrecord_ps_agreement_billing_sched",
                        isDynamic: true,
                    });
                    newParentRecId.setValue({ fieldId: "custrecord_ps_abs_date", value: new Date() });
                    parentBillingRecId = newParentRecId.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
                log.debug({ title: "Parent Billing Record Id", details: parentBillingRecId });
                if (!isEmpty(parentBillingRecId)) {
                    var billingSchTranId = getExistingBillingSchTran(parentBillingRecId, srchData.id);
                    log.debug({ title: "Agreement Detail Line Id | Existing Billing Schedule Tran Id", details: srchData.id + " | " + billingSchTranId });
                    var billingSchTran = null;
                    if (billingSchTranId) {
                        billingSchTran = record.load({
                            type: "customrecord_ps_agreement_billing_sc_tr",
                            id: billingSchTranId
                        });
                    }
                    else {
                        billingSchTran = record.create({
                            type: "customrecord_ps_agreement_billing_sc_tr"
                        });
                    }
                    if (billingSchTran) {
                        billingSchTran.setValue({ fieldId: "custrecord_ps_abst_agreement_billing_sch", value: parentBillingRecId });
                        billingSchTran.setValue({ fieldId: "custrecord_ps_abst_agreement", value: srchData.agreement });
                        billingSchTran.setValue({ fieldId: "custrecord_ps_abst_agreement_detail", value: srchData.id });
                        billingSchTran.setValue({ fieldId: "custrecord_ps_abst_calculated_amount", value: srchData.amount });
                        var newBillingSchTranId;
                        if (agreementType == "2") {//Usage Type
                            var usageAmount = getUsageAmount(srchData);
                            if (usageAmount) {
                                billingSchTran.setValue({ fieldId: "custrecord_ps_abst_calculated_amount", value: usageAmount });
                                newBillingSchTranId = billingSchTran.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });
                            }
                        }
                        else if (agreementType == "1") {//Subscription Type
                            var subscriptionAmount = getSubscriptionAmount(srchData);
                            if (subscriptionAmount) {
                                billingSchTran.setValue({ fieldId: "custrecord_ps_abst_calculated_amount", value: subscriptionAmount });
                                newBillingSchTranId = billingSchTran.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });
                            }
                        }
                        log.debug({ title: "New Billing Schedule Transaction Id", details: newBillingSchTranId });
                    }
                }
            }
        }
        catch (exp) {
            log.error({ title: "Error in map function", details: JSON.stringify(exp) });
        }
    }

    /**********************
     * Helper Functions****
    **********************/
    function getAgreementDetailLines(subsidiary, days) {
        var lines = [];
        var agreementLinesSrch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
                [
                    ["formulanumeric: CASE WHEN ABS(TO_DATE({custrecord_ps_aad_next_billing_date})-TO_DATE({today})) = " + days + " THEN 1 ELSE 0 END", "equalto", "1"],
                    "AND",
                    ["custrecord_ps_aad_agreement.custrecord_ps_a_subsidiary", "anyof", subsidiary]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_ps_aad_agreement", sort: search.Sort.ASC, label: "Agreement" }),
                    search.createColumn({ name: "custrecord_ps_aad_item", label: "Item" }),
                    search.createColumn({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                    search.createColumn({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                    search.createColumn({ name: "custrecord_ps_aad_status", label: "Status" }),
                    search.createColumn({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
                    search.createColumn({ name: "custrecord_ps_aad_rate", label: "Rate" }),
                    search.createColumn({ name: "custrecord_ps_aad_amount", label: "Amount" }),
                    search.createColumn({ name: "custrecord_ps_aad_required_minimum", label: "Required Minimum" }),
                    search.createColumn({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                    search.createColumn({ name: "custrecord_ps_aad_pricing_type", label: "Pricing Type" }),
                    search.createColumn({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                    search.createColumn({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                    search.createColumn({ name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key" }),
                    search.createColumn({ name: "custrecord_ps_aad_agreement_type", label: "Agreement Type" }),
                    search.createColumn({ name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date" }),
                    search.createColumn({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq" }),
                    search.createColumn({ name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity" }),
                    search.createColumn({ name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time" })
                ]
        });
        agreementLinesSrch.run().each(function (result) {
            lines.push({
                id: result.getValue({ name: "internalid", label: "Internal ID" }),
                agreement: result.getValue({ name: "custrecord_ps_aad_agreement", sort: search.Sort.ASC, label: "Agreement" }),
                item: result.getValue({ name: "custrecord_ps_aad_item", label: "Item" }),
                startDate: result.getValue({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                endDate: result.getValue({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                status: result.getValue({ name: "custrecord_ps_aad_status", label: "Status" }),
                quantity: result.getValue({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
                rate: result.getValue({ name: "custrecord_ps_aad_rate", label: "Rate" }),
                amount: result.getValue({ name: "custrecord_ps_aad_amount", label: "Amount" }),
                requiredMinimum: result.getValue({ name: "custrecord_ps_aad_required_minimum", label: "Required Minimum" }),
                nextBillingDate: result.getValue({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                lastBillingDate: result.getValue({ name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date" }),
                pricingType: result.getValue({ name: "custrecord_ps_aad_pricing_type", label: "Pricing Type" }),
                priceLevel: result.getValue({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                createdFrom: result.getValue({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                tranLineKey: result.getValue({ name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key" }),
                agreementType: result.getValue({ name: "custrecord_ps_aad_agreement_type", label: "Agreement Type" }),
                billingFreq: result.getValue({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq" }),
                billingFreqQty: result.getValue({ name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity" }),
                billingFreqTime: result.getValue({ name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time" }),
            });
            return true;
        });
        return lines;
    }
    function getAgreementBillingParent() {
        var parnetId = null;
        var billingSchParentSrch = search.create({
            type: "customrecord_ps_agreement_billing_sched",
            filters:
                [
                    ["custrecord_ps_abs_date", "within", "today"]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_ps_abs_date", label: "Date" })
                ]
        });
        billingSchParentSrch.run().each(function (result) {
            parnetId = result.getValue({ name: "internalid", label: "Internal ID" });
        });
        return parnetId;
    }
    function getExistingBillingSchTran(parentId, agreementDetailId) {
        var billingSchTranId = null;
        var billingSchTranSrch = search.create({
            type: "customrecord_ps_agreement_billing_sc_tr",
            filters:
                [
                    ["custrecord_ps_abst_agreement_detail", "anyof", agreementDetailId],
                    "AND",
                    ["custrecord_ps_abst_agreement_billing_sch", "anyof", parentId],
                ],
            columns:
                [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_ps_abst_agreement", label: "Agreement" }),
                    search.createColumn({ name: "custrecord_ps_abst_agreement_billing_sch", label: "Agreement Billing Schedule" }),
                    search.createColumn({ name: "custrecord_ps_abst_agreement_detail", label: "Agreement Detail" }),
                    search.createColumn({ name: "custrecord_ps_abst_calculated_amount", label: "Calculated Amount" })
                ]
        });
        billingSchTranSrch.run().each(function (result) {
            billingSchTranId = result.getValue({ name: "internalid", label: "Internal ID" });
        });
        return billingSchTranId;
    }
    function getSubscriptionAmount(lineData) {
        var subscriptionAmount = null;
        if (lineData.rate) {
            var billingStartDate = lineData.startDate;
            if (lineData.lastBillingDate) {
                billingStartDate = lineData.lastBillingDate
            }
            var currentRate = lineData.rate;
            if (lineData.status == "3") {
                var effectiveCancellationDate = getCancellationEffectiveDate(lineData.id);
                if (effectiveCancellationDate) {
                    if (moment(billingStartDate).isBefore(moment(effectiveCancellationDate))) {
                        currentRate = getProRate(lineData.rate, lineData.billingFreqQty, lineData.billingFreqTime, billingStartDate, effectiveCancellationDate);
                        if (currentRate) {
                            currentRate = currentRate.toFixed(2);
                        }
                        log.debug({ title: "New subscript line Pro rate", details: currentRate });
                    }
                    else {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
            if (currentRate) {
                subscriptionAmount = parseFloat(currentRate || 0) * parseFloat(lineData.qty || 0);//.toFixed(2)
            }
            else if (lineData.amount < 0) {
                subscriptionAmount = lineData.amount;
            }
            else {
                return null;
            }
        }
        if (lineData.requiredMinimum && parseFloat(lineData.requiredMinimum || 0) > 0) {
            if (currentLineAmount < parseFloat(lineData.requiredMinimum)) {
                subscriptionAmount = lineData.requiredMinimum;
            }
        }
        return subscriptionAmount;
    }
    function getProRate(rate, qty, time, startDate, endDate) {
        var prorate = 0;
        var currentProRateDays = 0;
        if (startDate && endDate) {
            currentProRateDays = Math.abs(moment(startDate).diff(moment(endDate), 'days'));
        }
        log.debug({ title: "Current pro rate days", details: currentProRateDays });
        if (rate && qty && time) {
            rate = parseFloat(rate || 0);
            qty = parseFloat(qty | 0);
            var timeId = getBillingFreqTimeScriptId(time);
            if (timeId == "days") {
                prorate = rate / (qty * 1);
            }
            else if (timeId == "weeks") {
                prorate = rate / (qty * 7);
            }
            else if (timeId == "months") {
                prorate = rate / (qty * 30);
            }
            else if (timeId == "quarters") {
                prorate = rate / (qty * 90);
            }
            else if (timeId == "years") {
                prorate = rate / (qty * 365);
            }
            else {
                prorate = rate / 1;
            }
        }
        log.debug({ title: "Pro rate per current days values", details: prorate * currentProRateDays });
        return prorate * currentProRateDays;
    }
    function getUsageAmount(lineData) {
        var usageAmount = null;
        var usageStartDate = lineData.startDate;
        var usageEndDate = lineData.nextBillingDate;
        if (lineData.lastBillingDate) {
            usageStartDate = lineData.lastBillingDate;
        }
        if (lineData.status == "3") {
            usageEndDate = null;
            var effectiveCancellationDate = getCancellationEffectiveDate(lineData.id);
            if (effectiveCancellationDate) {
                if (moment(usageStartDate).isBefore(moment(effectiveCancellationDate))) {
                    usageEndDate = effectiveCancellationDate;
                }
                else {
                    return;
                }
            }
        }
        if (usageEndDate) {
            var usageQty = getUsageQty(lineData.id, lineData.item, usageStartDate, usageEndDate);
            log.debug({ title: "Qty | Usage Start Date | Usage End Date", details: usageQty + " | " + usageStartDate + " | " + usageEndDate });
            if (usageQty > 0) {
                var currentUsageRate = lineData.rate;
                usageAmount = parseFloat(currentUsageRate || 0) * usageQty;
                var response = getRateAndAmount(lineData.priceLevel, lineData.billingFreq, usageQty, lineData.pricingType);
                if (parseFloat(response.rate || 0) > 0) {
                    currentUsageRate = parseFloat(response.rate || 0);
                    usageAmount = currentUsageRate * usageQty;
                }
                if (lineData.requiredMinimum && parseFloat(lineData.requiredMinimum || 0) > 0) {
                    if (currentLineAmount < parseFloat(lineData.requiredMinimum)) {
                        usageAmount = lineData.requiredMinimum;
                    }
                }
            }
        }

        return usageAmount;
    }
    function getUsageQty(agreementDetailid, itemId, startDate, endDate) {
        var totalQty = 0;
        var usageQtySrch = search.create({
            type: "customrecord_ps_agreement_usage",
            filters:
                [
                    ["custrecord_ps_au_agreement_detail", "anyof", agreementDetailid],
                    "AND",
                    ["custrecord_ps_au_item", "anyof", itemId],
                    "AND",
                    ["custrecord_ps_au_usage_date", "within", startDate, endDate]
                ],
            columns:
                [
                    search.createColumn({ name: "custrecord_ps_au_usage_qty", summary: "SUM", label: "Usage Quantity" })
                ]
        });
        usageQtySrch.run().each(function (result) {
            totalQty = result.getValue({ name: "custrecord_ps_au_usage_qty", summary: "SUM", label: "Usage Quantity" });
            return true;
        });
        return totalQty;
    }
    function getRateAndAmount(priceLevel, billingFreq, qty, priceType) {
        log.debug({ title: "PriceType", details: priceType });
        qty = parseFloat(qty);
        var response = {
            rate: 0,
            amount: 0
        };
        var lookResults = search.lookupFields({
            type: 'customrecord_ps_agreement_pricing',
            id: priceLevel,
            columns: ['custrecord_ps_req_agreement_pricing_type']
        });
        log.debug({ title: "Lookup Price Type val", details: lookResults.custrecord_ps_req_agreement_pricing_type });
        if (lookResults.custrecord_ps_req_agreement_pricing_type &&
            lookResults.custrecord_ps_req_agreement_pricing_type.length > 0) {
            priceType = lookResults.custrecord_ps_req_agreement_pricing_type;
        }
        log.debug({ title: "PriceLevel | Billing Freq | Qty | PriceType", details: priceLevel + " | " + billingFreq + " | " + qty + " | " + priceType });
        if (isEmpty(priceType) || priceType == "2" || priceType == "3") {// Max Volume
            var maxVolPricingSearch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                    [
                        ["custrecord_ps_ap_agreement_pricing", "anyof", priceLevel],
                        "AND",
                        ["custrecord_ps_ap_billing_frequency", "anyof", billingFreq],
                        "AND",
                        ["custrecord_ps_ap_min_qty", "lessthanorequalto", qty],
                        "AND",
                        ["custrecord_ps_ap_max_qty", "greaterthanorequalto", qty]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing" }),
                        search.createColumn({ name: "custrecord_ps_ap_min_qty", label: "Min Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency" }),
                        search.createColumn({ name: "custrecord_ps_ap_rate", label: "Rate" }),
                        search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                    ]
            });
            maxVolPricingSearch.run().each(function (result) {
                response = {
                    rate: result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" }),
                    amount: parseFloat(result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" })) * qty
                };
                return true;
            });
        }
        else if (priceType == "3") {//Max Tier Flat Rate
            var flatRatePricingSearch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                    [
                        ["custrecord_ps_ap_agreement_pricing", "anyof", priceLevel],
                        "AND",
                        ["custrecord_ps_ap_billing_frequency", "anyof", billingFreq],
                        "AND",
                        ["custrecord_ps_ap_min_qty", "lessthanorequalto", qty],
                        "AND",
                        ["custrecord_ps_ap_max_qty", "greaterthanorequalto", qty]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing" }),
                        search.createColumn({ name: "custrecord_ps_ap_min_qty", label: "Min Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency" }),
                        search.createColumn({ name: "custrecord_ps_ap_rate", label: "Rate" }),
                        search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                    ]
            });
            flatRatePricingSearch.run().each(function (result) {
                response = {
                    rate: result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" }),
                    amount: parseFloat(result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" }))
                };
                return true;
            });
        }
        else if (priceType == "1") {
            var perTierPriceSrch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                    [
                        ["custrecord_ps_ap_agreement_pricing", "anyof", priceLevel],
                        "AND",
                        ["custrecord_ps_ap_billing_frequency", "anyof", billingFreq]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing" }),
                        search.createColumn({ name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency" }),
                        search.createColumn({ name: "custrecord_ps_ap_rate", label: "Rate" }),
                        search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                    ]
            });
            var qtyCalculation = qty;
            var minQty;
            var maxQty;
            perTierPriceSrch.run().each(function (result) {
                minQty = parseFloat(result.getValue({ name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty" }));
                maxQty = parseFloat(result.getValue({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }));
                if (minQty <= qty) {
                    if (maxQty <= qty) {
                        response.rate = parseFloat(result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" }));
                        response.amount = response.amount + (maxQty * response.rate);
                    }
                    else {
                        response.rate = parseFloat(result.getValue({ name: "custrecord_ps_ap_rate", label: "Rate" }));
                        qtyCalculation = qty - (minQty - 1);
                        response.amount = response.amount + (qtyCalculation * response.rate);
                    }
                }
                return true;
            });
        }
        if (response && response.amount && response.rate) {
            response.rate = parseFloat(response.amount) / qty;
        }
        return response;
    }
    function getCancellationEffectiveDate(detailLineId) {
        var effectiveDate = null;
        var cancellationSrch = search.create({
            type: "customrecord_ps_agreement_conculsion",
            filters:
                [
                    ["custrecord_ps_ac_concluding_event", "anyof", "2"],
                    "AND",
                    ["custrecord_ps_as_agreement_detail", "anyof", detailLineId]
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
        cancellationSrch.run().each(function (result) {
            effectiveDate = result.getValue({
                name: "custrecord_ps_ac_effective_date",
                summary: "MAX",
                label: "Effective Date"
            });
        });
        return effectiveDate;
    }
    function getBillingFreqTimeScriptId(id) {
        var lookResults = search.lookupFields({
            type: 'customrecord_ps_time',
            id: id,
            columns: ['custrecord_ps_t_script_name']
        });
        return lookResults.custrecord_ps_t_script_name;
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