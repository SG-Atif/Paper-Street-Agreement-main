/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/format', 'N/runtime'],
    function (log, search, record, moment, format, runtime) {
        function getInputData() {
            var agreementList = [];
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
                        search.createColumn({ name: "custrecord_ps_ap_use_cancel_tran", label: "Use Cancellation Transaction" }),
                        search.createColumn({ name: "custrecord_ps_ap_agreement_tran_status", label: "Agreement Transaction Status" }),
                        search.createColumn({ name: "custrecord_ps_ap_invoice_creation_days_a", label: "Invoice Creation Days In Advance" })
                    ]
            });
            preferencesSearch.run().each(function (currentPref) {
                var subsidiary = currentPref.getValue({ name: "custrecord_ps_ap_subsidiary", label: "Subsidiary" });
                var billingAdvanceDays = currentPref.getValue({ name: "custrecord_ps_ap_invoice_creation_days_a", label: "Invoice Creation Days In Advance" });
                if (isEmpty(billingAdvanceDays)) {
                    billingAdvanceDays = 0;
                }
                //log.debug({title: "Subsidiary | Advance Billing Days", details: subsidiary +" | "+ billingAdvanceDays});
                var agreementSrch = search.create({
                    type: "customrecord_ps_agreement_details",
                    filters:
                        [
                            ["custrecord_ps_aad_agreement", "anyof", "7117"],
                            //["formulanumeric: CASE WHEN (ROUND(({custrecord_ps_aad_next_billing_date}-{today}), 0)) = "+billingAdvanceDays+" THEN 1 ELSE 0 END","equalto","1"],
                            "AND",
                            ["custrecord_ps_aad_agreement.custrecord_ps_a_subsidiary", "anyof", subsidiary],
                            "AND",
                            ["custrecord_ps_aad_status", "anyof", "3", "2"],//Active & Cancelled
                            "AND",
                            ["formulanumeric: CASE WHEN {custrecord_ps_aad_next_billing_date} = {custrecord_ps_aad_last_billing_date} THEN 1 ELSE 0 END", "equalto", "0"]
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
                agreementSrch.run().each(function (result) {
                    agreementList.push({
                        agreementId: result.getValue({
                            name: "custrecord_ps_aad_agreement",
                            summary: "GROUP",
                            sort: search.Sort.ASC,
                            label: "Agreement"
                        }),
                        advanceBillingDays: billingAdvanceDays
                    });
                    return true;
                });
                return true;
            });
            return agreementList;
        }

        function map(context) {
            try {
                if (context.value) {
                    log.debug({ title: "Map Data", details: context.value });
                    var srchResult = JSON.parse(context.value);
                    if (srchResult) {
                        var agreementId = srchResult.agreementId;
                        var billingDays = srchResult.advanceBillingDays;
                        if (agreementId) {
                            log.debug({ title: "Agreement Id", details: agreementId });
                            // Load agreement record
                            var agreementRec = record.load({
                                type: 'customrecord_ps_agreement',
                                id: agreementId
                            });
                            var subsidiary = agreementRec.getValue("custrecord_ps_a_subsidiary");
                            var isBillingFromSOEnable = false;
                            if (subsidiary) {
                                isBillingFromSOEnable = isBillingFromSalesOrderEnable(subsidiary);
                            }
                            log.debug({ title: "Is Billing From Sales Order Enable", details: isBillingFromSOEnable });
                            if (isBillingFromSOEnable == false) {
                                createStandaloneInvoice(context, agreementId, agreementRec, subsidiary, billingDays);
                            }
                            else {
                                createInvoiceFromSalesOrder(context, agreementId, agreementRec, subsidiary, billingDays);
                            }
                        }
                    }
                }
            }
            catch (exp) {
                log.error({ title: "Error In Map Function", details: JSON.stringify(exp) });
            }
        }

        function reduce(context) {
            try {
                log.debug({ title: "Reduce | Context", details: context });
                if (context.values) {
                    var currentUserObj = runtime.getCurrentUser();
                    var dateFormat = currentUserObj.getPreference({
                        name: 'dateformat'
                    });
                    setNextBillingDate(context.key, dateFormat, context.values[0]);
                }
            }
            catch (error) {
                log.error({ title: "Error in Reduce", details: error });
            }
        }

        /**********************
         * Helper Functions****
        **********************/
        function createInvoiceFromSalesOrder(context, agreementId, agreementRec, subsidiary, billingDays) {
            var agreementDetailList = getAgreementDetailLines(agreementId, billingDays);
            if (agreementDetailList && agreementDetailList.length > 0) {
                log.debug({ title: "Agreement Detail Data", details: agreementDetailList });
                var createdFromList = agreementDetailList.map(function (x) { return x.createdFrom });
                if (createdFromList && createdFromList.length > 0) {
                    createdFromList = getDistinctArray(createdFromList);
                    log.debug({ title: "Sales Order List", details: JSON.stringify(createdFromList) });
                    var agreementContract = agreementRec.getValue("custrecord_ps_a_contract_term");
                    var agreementContractTime, agreementContractQty;
                    if (agreementContract) {
                        var contractResult = search.lookupFields({
                            type: 'customrecord_ps_agreement_frequency',
                            id: agreementContract,
                            columns: ["custrecord_ps_ct_time", "custrecord_ps_ct_time.custrecord_ps_t_script_name", "custrecord_ps_ct_quantity"]
                        });
                        if (contractResult) {
                            agreementContractQty = contractResult.custrecord_ps_ct_quantity;
                            agreementContractTime = contractResult["custrecord_ps_ct_time.custrecord_ps_t_script_name"];
                        }
                    }

                    for (var c = 0; c < createdFromList.length; c++) {
                        try {
                            log.debug({ title: "Transaction Id", details: createdFromList[c] });
                            var salesOrderRec = record.load({
                                type: "salesorder",
                                id: createdFromList[c],
                                isDynamic: true,
                            });
                            var newInvoice = record.transform({
                                fromType: "salesorder",
                                fromId: createdFromList[c],
                                toType: "invoice",
                                isDynamic: true,
                            });
                            if (newInvoice) {
                                var currentSOAgreementLines = agreementDetailList.filter(function (a) { return a.createdFrom == createdFromList[c] && a.agreementType != null && a.agreementType != "" });
                                if (currentSOAgreementLines && currentSOAgreementLines.length > 0) {
                                    var invLineCount = newInvoice.getLineCount("item");
                                    if (invLineCount > 0) {
                                        var currentLineItem, currentLineKey, currentLineQty, currentBilledQty, currentLineRate, currentAgreementLineArray, soLineIndex, termInMonth;
                                        for (var line = (invLineCount - 1); line >= 0; line--) {
                                            currentLineItem = newInvoice.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'item',
                                                line: line,
                                            });
                                            currentLineKey = newInvoice.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'lineuniquekey',
                                                line: line,
                                            });
                                            currentLineBillingFreq = newInvoice.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_ps_billing_frequency',
                                                line: line,
                                            });
                                            soLineIndex = salesOrderRec.findSublistLineWithValue({
                                                sublistId: 'item',
                                                fieldId: 'lineuniquekey',
                                                value: currentLineKey
                                            });
                                            if (soLineIndex > -1) {
                                                currentLineQty = parseFloat(salesOrderRec.getSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'quantity',
                                                    line: soLineIndex,
                                                })||0);
                                                currentBilledQty = salesOrderRec.getSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'quantitybilled',
                                                    line: soLineIndex,
                                                });
                                                currentLineRate = salesOrderRec.getSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'rate',
                                                    line: soLineIndex,
                                                });
                                                currentLineAmount = salesOrderRec.getSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'amount',
                                                    line: soLineIndex,
                                                });
                                                log.debug({
                                                    title: "Line Item | Key | Qty | Rate | currentLineBillingFreq",
                                                    details: currentLineItem + " | " + currentLineKey + " | " + currentLineQty
                                                        + " | " + currentLineRate + " | " + currentLineBillingFreq
                                                });
                                                var totalBillingQty = 0;
                                                var rateBillingQty = 0;
                                                var isProRated = false;
                                                var rateFreq = 0;
                                                currentAgreementLineArray = currentSOAgreementLines.filter(function (a) { return a.item == currentLineItem && a.tranLineKey == currentLineKey });
                                                log.debug({ title: "Current Line Array", details: JSON.stringify(currentAgreementLineArray) });
                                                if (currentAgreementLineArray && currentAgreementLineArray.length > 0) {
                                                    var billingFreqTime = null;
                                                    if (currentAgreementLineArray[0].billingFreqText && currentAgreementLineArray[0].billingFreqText != "One-Time") {
                                                        billingFreqTime = getBillingFreqTimeScriptId(currentAgreementLineArray[0].billingFreqTime);
                                                        log.debug({ title: "billingFreqTime |  agreementContractTime", details: billingFreqTime + " | " + agreementContractTime });
                                                    }
                                                    if (currentAgreementLineArray[0].billingFreqText == "One-Time") {
                                                        totalBillingQty = 1;
                                                        isProRated = false;
                                                        rateFreq = 1;
                                                    }
                                                    else if (currentAgreementLineArray[0].endDate && currentAgreementLineArray[0].startDate) {
                                                        totalBillingQty = Math.round(moment(currentAgreementLineArray[0].endDate).diff(currentAgreementLineArray[0].startDate, billingFreqTime, true));
                                                        if (currentAgreementLineArray[0].lastBillingDate && currentAgreementLineArray[0].nextBillingDate) {
                                                            termInMonth = Math.round(moment(currentAgreementLineArray[0].nextBillingDate).diff(currentAgreementLineArray[0].lastBillingDate, "months", true));
                                                        }
                                                        else if(currentAgreementLineArray[0].nextBillingDate && currentAgreementLineArray[0].startDate){
                                                            termInMonth = Math.round(moment(currentAgreementLineArray[0].nextBillingDate).diff(currentAgreementLineArray[0].startDate, "months", true));
                                                        }
                                                        rateBillingQty = getBillingFreqQtyInMonths(billingFreqTime, parseFloat(currentAgreementLineArray[0].billingFreqQty || 0));
                                                        log.debug({ title: "Billing Rate Qty | Total Billing Qty | Term In Month", details: rateBillingQty + " | " + totalBillingQty + " | " + termInMonth });
                                                        if (rateBillingQty != null && rateBillingQty != 0) {
                                                            if (termInMonth) {
                                                                rateFreq = parseFloat(termInMonth) / parseFloat(rateBillingQty);
                                                                if (rateFreq < 1) {
                                                                    isProRated = true;
                                                                }
                                                            }
                                                        }
                                                        log.debug({ title: "Total Billing Qty | Rate Billing Qty | Rate Freq", details: totalBillingQty + " | " + rateBillingQty + " | " + rateFreq });
                                                    }
                                                    else if (billingFreqTime == agreementContractTime) {
                                                        var billingFreTotalQty = currentAgreementLineArray[0].billingFreqQty;
                                                        log.debug({ title: "Billing Freq Total Qty | Contract Term Total Qty", details: billingFreTotalQty + " | " + agreementContractQty });
                                                        if (billingFreTotalQty > 0) {
                                                            totalBillingQty = agreementContractQty / billingFreTotalQty;
                                                        }
                                                    }
                                                    else {
                                                        var billingFreTotalQty = getQtyInContractTerms(agreementContractTime, billingFreqTime, currentAgreementLineArray[0].billingFreqQty);
                                                        log.debug({ title: "Billing Freq Total Qty | Contract Term Total Qty", details: billingFreTotalQty + " | " + agreementContractQty });
                                                        if (billingFreTotalQty > 0) {
                                                            totalBillingQty = agreementContractQty / billingFreTotalQty;
                                                        }
                                                    }
                                                    if (totalBillingQty && totalBillingQty != 0) {
                                                        newInvoice.selectLine({
                                                            sublistId: 'item',
                                                            line: line
                                                        });
                                                        newInvoice.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: 'item',
                                                            value: currentLineItem
                                                        });
                                                        log.debug({
                                                            title: "Current Line Qty | Calculated Qty", details: parseFloat(newInvoice.getCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: 'quantity',
                                                            })) + " | " + parseFloat(currentLineQty / totalBillingQty)
                                                        })
                                                        if (!moment(currentAgreementLineArray[0].nextBillingDate).isSame(currentAgreementLineArray[0].endDate)) {
                                                            newInvoice.setCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: 'quantity',
                                                                value: parseFloat(currentLineQty / totalBillingQty)
                                                            });
                                                        }
                                                        if (currentLineRate == 0) {
                                                            if (rateFreq != 0 && isProRated == true) {
                                                                newInvoice.setCurrentSublistValue({
                                                                    sublistId: 'item',
                                                                    fieldId: 'amount',
                                                                    value: parseFloat(currentLineAmount * rateFreq)
                                                                });
                                                            }
                                                            else {
                                                                newInvoice.setCurrentSublistValue({
                                                                    sublistId: 'item',
                                                                    fieldId: 'amount',
                                                                    value: parseFloat(currentLineAmount / totalBillingQty)
                                                                });
                                                            }
                                                        }
                                                        else if (currentLineAmount != 0) {
                                                            if (rateFreq != 0 && isProRated == true) {
                                                                newInvoice.setCurrentSublistValue({
                                                                    sublistId: 'item',
                                                                    fieldId: 'rate',
                                                                    value: parseFloat(currentLineRate * rateFreq)
                                                                });
                                                            }
                                                            else {
                                                                newInvoice.setCurrentSublistValue({
                                                                    sublistId: 'item',
                                                                    fieldId: 'rate',
                                                                    value: currentLineRate
                                                                });
                                                            }
                                                        }
                                                        newInvoice.commitLine({
                                                            sublistId: 'item'
                                                        });
                                                        context.write({
                                                            key: currentAgreementLineArray[0].id,
                                                            value: currentAgreementLineArray[0].nextBillingDate,
                                                        });
                                                    }
                                                    else {
                                                        newInvoice.removeLine({
                                                            sublistId: 'item',
                                                            line: line,
                                                            ignoreRecalc: false
                                                        });
                                                    }
                                                }
                                                else {
                                                    newInvoice.removeLine({
                                                        sublistId: 'item',
                                                        line: line,
                                                        ignoreRecalc: false
                                                    });
                                                }
                                            }
                                            else {
                                                var newInvoiceId = newInvoice.removeLine({
                                                    sublistId: 'item',
                                                    line: line,
                                                    ignoreRecalc: false
                                                });
                                                log.debug({ title: "New invoice id", details: newInvoiceId });
                                            }
                                        }
                                    }
                                }
                                else {
                                    log.debug({ title: "No agreement line found for SO", details: "SO Id - " + createdFromList[c] });
                                }
                            }
                            var lineCountAgain = newInvoice.getLineCount("item");
                            if (lineCountAgain > 0) {
                                newInvoice.save({
                                    enableSourcing: true,
                                    ignoreMandatoryFields: true
                                });
                            }
                            else {
                                log.debug({ title: "No line item added to the invoice.", details: "No line item added to the invoice." });
                            }
                        }
                        catch (exp) {
                            log.debug({ title: "Warning!", details: exp });
                        }
                    }
                }
                else {
                    log.debug({ title: "No Sales Order Found.", details: "Agreement detail lines don't have any sales order reference." });
                }
            }
        }
        function createStandaloneInvoice(context, agreementId, agreementRec, subsidiary, billingDays) {
            var currentUserObj = runtime.getCurrentUser();
            var dateFormat = currentUserObj.getPreference({
                name: 'dateformat'
            });
            var agreementDetailList = getAgreementDetailLines(agreementId, billingDays);
            if (agreementDetailList && agreementDetailList.length > 0) {
                log.debug({ title: "Agreement Detail Data", details: agreementDetailList });
                var newInvoice = record.create({
                    type: "invoice",
                    isDynamic: true,
                    defaultValues: {
                        entity: agreementRec.getValue("custrecord_ps_a_customer")
                    }
                });
                if (newInvoice) {
                    newInvoice.setValue({ fieldId: "subsidiary", value: subsidiary });
                    newInvoice.setValue({ fieldId: "custbody_ps_agreement", value: agreementId });
                    newInvoice.setValue({ fieldId: "custbody_ps_agreement_term", value: agreementRec.getValue("custrecord_ps_a_contract_term") });
                    newInvoice.setValue({ fieldId: "custbody_ps_create_new_agreement", value: true });
                    newInvoice.setValue({ fieldId: "custbody_ps_agreement_payment_method", value: agreementRec.getValue("custrecord_ps_a_payment_method") });
                    newInvoice.setValue({ fieldId: "currency", value: agreementRec.getValue("custrecord_ps_a_currency") });
                    for (var j = 0; j < agreementDetailList.length; j++) {
                        if (agreementDetailList[j].agreementType == "2") {//Usage line
                            newInvoice = addUsageLine(newInvoice, agreementDetailList[j]);
                        }
                        else if(agreementDetailList[j].agreementType == "1"){//Subscription line
                            newInvoice = addSubscriptionLine(newInvoice, agreementDetailList[j]);
                        }
                    }
                    var total = parseFloat(newInvoice.getValue("total") || 0);
                    var requiredMin = parseFloat(agreementRec.getValue("custrecord_ps_a_required_monthly_min") || 0);
                    var requiredMinItem = null;
                    var prefSrch = search.create({
                        type: "customrecord_ps_agreement_preferences",
                        filters:
                            [
                                ["isinactive", "is", "F"],
                                "AND",
                                ["custrecord_ps_ap_subsidiary", "anyof", agreementRec.getValue("custrecord_ps_a_subsidiary")]
                            ],
                        columns:
                            [
                                search.createColumn({ name: "internalid", label: "Internal ID" }),
                                search.createColumn({ name: "custrecord_ps_ap_req_min_adj_item", label: "Required Minimum Adjustment Item" })
                            ]
                    });
                    prefSrch.run().each(function (result) {
                        requiredMinItem = result.getValue({ name: "custrecord_ps_ap_req_min_adj_item", label: "Required Minimum Adjustment Item" });
                        return true;
                    });
                    log.debug({ title: "Invoice total | Min Req | Adjustment Item", details: total + " | " + requiredMin + " | " + requiredMinItem });
                    if (requiredMinItem && requiredMin) {
                        if (requiredMin > total) {
                            newInvoice = addMinimumAdjustmentLine(newInvoice, requiredMinItem, (requiredMin - total));
                        }
                    }
                    var newInvoiceId = newInvoice.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.debug({ title: "Invoice Id", details: newInvoiceId });
                    if (newInvoiceId) {
                        // Pass data to reduce, so it can update next billing date.
                        for (var c = 0; c < agreementDetailList.length; c++) {
                            context.write({
                                key: agreementDetailList[c].id,
                                value: agreementDetailList[c].nextBillingDate,
                            });
                        }
                    }
                }
            }
            else {
                log.debug({ title: "No agreement detail found." });
            }
        }
        function getAgreementDetailLines(agreementId, billingDays) {
            var agreementDetailList = [];
            var agreementDetailSrch = search.create({
                type: "customrecord_ps_agreement_details",
                filters:
                    [
                        ["custrecord_ps_aad_next_billing_date","on","12/15/2022"],
                        //["formulanumeric: CASE WHEN (ROUND(({custrecord_ps_aad_next_billing_date}-{today}), 0)) = "+billingDays+" THEN 1 ELSE 0 END","equalto","1"],
                        //"AND", 
                        //["internalid", "anyof", ["8814", "8815", "8816"]],
                        "AND",
                        ["custrecord_ps_aad_status", "anyof", "2", "3"],
                        "AND",
                        ["custrecord_ps_aad_agreement", "anyof", agreementId]
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
            agreementDetailSrch.run().each(function (result) {
                agreementDetailList.push({
                    id: result.getValue({ name: "internalid", label: "Internal ID" }),
                    item: result.getValue({ name: "custrecord_ps_aad_item", label: "Item" }),
                    startDate: result.getValue({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                    endDate: result.getValue({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                    status: result.getValue({ name: "custrecord_ps_aad_status", label: "Status" }),
                    qty: result.getValue({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
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
                    billingFreqText: result.getText({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Freq" }),
                    billingFreqQty: result.getValue({ name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity" }),
                    billingFreqTime: result.getValue({ name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time" }),
                });
                return true;
            });
            return agreementDetailList;
        }
        function addMinimumAdjustmentLine(invoice, item, amount) {
            invoice.selectNewLine({ sublistId: 'item' });
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
        function addSubscriptionLine(invoice, lineData) {
            invoice.selectNewLine({ sublistId: 'item' });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: lineData.item,
            });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ps_agreement_pricing',
                value: lineData.priceLevel,
            });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ps_agreement_type',
                value: lineData.agreementType,
            });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ps_required_minimum',
                value: lineData.requiredMinimum,
            });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: lineData.qty,
            });
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
                            return invoice;
                        }
                    }
                    else {
                        return invoice;
                    }
                }
                log.debug({title: "Line rate", details: currentRate});
                if (currentRate) {
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: currentRate,//.toFixed(2)
                    });
                    var currentLineAmount = parseFloat(currentRate || 0) * parseFloat(lineData.qty || 0);//.toFixed(2)
                    if (parseFloat(lineData.amount || 0) < 0) {
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: (parseFloat(lineData.amount) / parseFloat(lineData.qty)).toFixed(2),
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: lineData.amount,
                        });
                    }
                    else {
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: currentLineAmount,
                        });
                    }
                }
                else {
                    return invoice;
                }
            }
            if (lineData.requiredMinimum && parseFloat(lineData.requiredMinimum || 0) > 0) {
                if (currentLineAmount < parseFloat(lineData.requiredMinimum)) {
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
        function addUsageLine(invoice, lineData) {
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
                        return invoice;
                    }
                }
            }
            if (usageEndDate) {
                var usageQty = getUsageQty(lineData.id, lineData.item, usageStartDate, usageEndDate);
                log.debug({ title: "Qty | Usage Start Date | Usage End Date", details: usageQty + " | " + usageStartDate + " | " + usageEndDate });
                var isSplitTeir = isSplitTierChecked(lineData.priceLevel);
                log.debug({ title: "Is Price Level Set To Split Tiers", details: isSplitTeir});
                if (usageQty > 0) {
                    if(isSplitTeir == true){
                        invoice = addSplitTierUsageLines(invoice, lineData, usageQty);
                    }
                    else{
                        invoice.selectNewLine({ sublistId: 'item' });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: lineData.item,
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ps_agreement_pricing',
                            value: lineData.priceLevel,
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ps_agreement_type',
                            value: lineData.agreementType,
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ps_required_minimum',
                            value: lineData.requiredMinimum,
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: usageQty,
                        });
                        var currentUsageRate = lineData.rate;
                        var currentLineAmount = parseFloat(currentUsageRate || 0) * usageQty;
                        if(lineData.priceLevel){
                            var response = getRateAndAmount(lineData.priceLevel, lineData.billingFreq, usageQty, lineData.pricingType);
                            if (parseFloat(response.rate || 0) > 0) {
                                currentUsageRate = parseFloat(response.rate || 0);
                                currentLineAmount = currentUsageRate * usageQty;
                            }
                        }
                        if (currentUsageRate) {
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
                        if (lineData.requiredMinimum && parseFloat(lineData.requiredMinimum || 0) > 0) {
                            if (currentLineAmount < parseFloat(lineData.requiredMinimum)) {
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
            }
            return invoice;
        }
        function isSplitTierChecked(priceLevel){
            var response = false;
            if(priceLevel){
                var lookupResults = search.lookupFields({
                    type: 'customrecord_ps_agreement_pricing',
                    id: priceLevel,
                    columns: ['custrecord_ps_ap_per_tier_split']
                });
                if (lookupResults.custrecord_ps_ap_per_tier_split) {
                    response = lookupResults.custrecord_ps_ap_per_tier_split;
                }
            }
            return response;
        }
        function addSplitTierUsageLines(invoice, lineData, qty){
            var perTierPriceSrch = search.create({
                type: "customrecord_ps_agreement_pricing_detail",
                filters:
                    [
                        ["custrecord_ps_ap_agreement_pricing", "anyof", lineData.priceLevel],
                        "AND",
                        ["custrecord_ps_ap_billing_frequency", "anyof", lineData.billingFreq]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_ap_agreement_pricing", label: "Agreement Pricing" }),
                        search.createColumn({ name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }),
                        search.createColumn({ name: "custrecord_ps_ap_billing_frequency", label: "Billing Frequency" }),
                        search.createColumn({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
                        search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                    ]
            });
            var qtyCalculation = qty;
            var minQty;
            var maxQty;
            var assignedQty = 0;
            log.debug("Total Usage Qty", qty);
            perTierPriceSrch.run().each(function (result) {
                minQty = parseFloat(result.getValue({ name: "custrecord_ps_ap_min_qty", sort: search.Sort.ASC, label: "Min Qty" }));
                maxQty = parseFloat(result.getValue({ name: "custrecord_ps_ap_max_qty", label: "Max Qty" }));
                if (minQty <= qty) {
                    if (maxQty <= qty) {
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: maxQty - assignedQty,
                        });
                        assignedQty = maxQty;
                    }
                    else {
                        qtyCalculation = (qty - (minQty - 1));
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: qtyCalculation,
                        });
                    }
                    invoice.selectNewLine({ sublistId: 'item' });
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: lineData.item,
                    });
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ps_agreement_pricing',
                        value: lineData.priceLevel,
                    });
                    invoice.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ps_agreement_type',
                        value: lineData.agreementType,
                    });
                    var currentUsageRate = parseFloat(result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }));
                    var currentLineAmount = parseFloat(currentUsageRate || 0) * qtyCalculation;
                    if (currentUsageRate) {
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
                        invoice.commitLine({
                            sublistId: 'item'
                        });
                    }
                }
                return true;
            });
            return invoice;
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
                        ["custrecord_ps_au_usage_date", "within", startDate, endDate],
                        "AND",
                        ["custrecord_ps_au_is_billed", "is", "F"]
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
            log.debug({ title: "PriceLevel | Billing Freq | Qty | PriceType", details: priceLevel + " | " + billingFreq + " | " + qty + " | " + priceType });
            if (isEmpty(priceType) || priceType == "2") {// Max Volume
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
                            search.createColumn({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
                            search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                        ]
                });
                maxVolPricingSearch.run().each(function (result) {
                    response = {
                        rate: result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
                        amount: parseFloat(result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" })) * qty
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
                            search.createColumn({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
                            search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type", join: "CUSTRECORD_PS_AP_AGREEMENT_PRICING", label: "Require Agreement Pricing Type" })
                        ]
                });
                flatRatePricingSearch.run().each(function (result) {
                    response = {
                        rate: result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
                        amount: parseFloat(result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }))
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
                            search.createColumn({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }),
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
                            response.rate = parseFloat(result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }));
                            response.amount = response.amount + (maxQty * response.rate);
                        }
                        else {
                            response.rate = parseFloat(result.getValue({ name: "custrecord_ps_ap_usage_rate", label: "Rate" }));
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
        function isEmpty(value) {
            if (value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
            return false;
        }
        function getDistinctArray(arr) {
            var a = [];
            for (var i = 0, l = arr.length; i < l; i++)
                if (a.indexOf(arr[i]) === -1 && arr[i] !== '')
                    a.push(arr[i]);
            return a;
        }
        function setNextBillingDate(ids, dateFormat, currentNextBillDate) {
            log.debug({ title: "id", details: ids });
            var agreementNextBillSrch = search.create({
                type: "customrecord_ps_agreement_details",
                filters:
                    [
                        ["internalid", "anyof", ids],
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_aad_agreement", label: "Agreement" }),
                        search.createColumn({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                        search.createColumn({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                        search.createColumn({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                        search.createColumn({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency" }),
                        search.createColumn({ name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time" }),
                        search.createColumn({ name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity" }),
                        search.createColumn({ name: "custrecord_ps_aad_status", label: "Status" }),
                    ]
            });
            agreementNextBillSrch.run().each(function (result) {
                var data = {
                    id: result.getValue({ name: "internalid", label: "Internal ID" }),
                    startDate: result.getValue({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                    endDate: result.getValue({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                    nextBillingDate: currentNextBillDate ? currentNextBillDate : result.getValue({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                    billingFreq: result.getValue({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency" }),
                    billingFreqQty: result.getValue({ name: "custrecord_ps_ct_quantity", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Quantity" }),
                    billingFreqTime: result.getValue({ name: "custrecord_ps_ct_time", join: "CUSTRECORD_PS_AAD_BILLING_FREQUENCY", label: "Time" }),
                    status: result.getValue({ name: "custrecord_ps_aad_status", label: "Status" })
                };
                log.debug({ title: "Next Billing Date Data", details: data });
                if (data.status == "2") { // Active
                    if (data['billingFreqTime']) {
                        data['billingFreqScriptid'] = getBillingFreqTimeScriptId(data['billingFreqTime']);
                    }
                    log.debug({ title: "Data detail", details: data });
                    var newNextBillingDate = getNextBillingDate(data['startDate'], data['nextBillingDate'], data['billingFreqQty'],
                        data['billingFreqScriptid'], data['endDate'], dateFormat);
                    if (newNextBillingDate) {
                        updateAgreementDetail(data['id'], newNextBillingDate, data.nextBillingDate, dateFormat);
                    }
                }
                else if (data.status == "3") {//Cancel
                    updateAgreementDetail(data['id'], data.nextBillingDate, data.nextBillingDate, dateFormat);
                }
                return true;
            });
        }
        function getBillingFreqTimeScriptId(id) {
            var lookResults = search.lookupFields({
                type: 'customrecord_ps_time',
                id: id,
                columns: ['custrecord_ps_t_script_name']
            });
            return lookResults.custrecord_ps_t_script_name;
        }
        function getNextBillingDate(startDate, previousBillingDate, qty, timeId, endDate, dateFormat) {
            log.debug({title: "getNextBillingDate -- startDate | previousBillingDate | qty | timeId, endDate", 
                        details: startDate +" | "+ previousBillingDate+" | "+ qty+" | "+ timeId+" | "+ endDate})
            if (previousBillingDate) {
                startDate = previousBillingDate;
            }
            var nextBillingDate = '';
            if (startDate && qty && timeId) {
                nextBillingDate = moment(startDate).add(qty, timeId);
                if (nextBillingDate) {
                    var current = moment();
                    if (moment(nextBillingDate).isSameOrBefore(current)) {
                        nextBillingDate = getNextBillingDate('', nextBillingDate, qty, timeId, endDate);
                    }
                }
            }
            if (endDate) {
                if (moment(nextBillingDate).isSameOrAfter(moment(endDate))) {
                    nextBillingDate = endDate;
                }
            }
            //log.debug({title: "nextBillingDate", details: nextBillingDate});
            return nextBillingDate ? moment(nextBillingDate).format(dateFormat) : '';
        }
        function updateAgreementDetail(id, nextBillingDate, previousBillingDate, dateFormat) {
            log.debug({ title: "Next Billing Date | Date Format", details: nextBillingDate+" | "+dateFormat });
            var currentDetailRec = record.load({
                type: 'customrecord_ps_agreement_details',
                id: id
            });
            //log.debug({title: "Next Billing Date", details: nextBillingDate});
            currentDetailRec.setValue({
                fieldId: 'custrecord_ps_aad_next_billing_date',
                value: format.parse({ value: moment(nextBillingDate).format(dateFormat), type: format.Type.DATE }),
            });
            currentDetailRec.setValue({
                fieldId: 'custrecord_ps_aad_last_billing_date',
                value: format.parse({ value: moment(previousBillingDate).format(dateFormat), type: format.Type.DATE }),
            });
            currentDetailRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
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
        function isBillingFromSalesOrderEnable(subsidiary) {
            var isEnabled = false;
            var preferencesSearch = search.create({
                type: "customrecord_ps_agreement_preferences",
                filters:
                    [
                        ["isinactive", "is", "F"],
                        "AND",
                        ["custrecord_ps_ap_subsidiary", "anyof", subsidiary]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_ps_ap_subsidiary", label: "Subsidiary" }),
                        search.createColumn({ name: "custrecord_ps_create_billing_from_so", label: "Billing From Sales Order" }),
                    ]
            });
            preferencesSearch.run().each(function (currentPref) {
                isEnabled = currentPref.getValue({ name: "custrecord_ps_create_billing_from_so", label: "Billing From Sales Order" })
            });
            return isEnabled;
        }
        function getQtyInContractTerms(contractTime, billingFreqTime, BillingFreqQty) {
            var total = 0;
            switch (contractTime) {
                case "years":
                    if (billingFreqTime == "months") {
                        total = BillingFreqQty / 12;
                    }
                    else if (billingFreqTime == "quarters") {
                        total = BillingFreqQty / 4;
                    }
                    else if (billingFreqTime == "weeks") {
                        total = BillingFreqQty / 52.1429;
                    }
                    else if (billingFreqTime == "days") {
                        total = BillingFreqQty / 365;
                    }
                    break;
                case "quarters":
                    if (billingFreqTime == "years") {
                        total = BillingFreqQty * 4;
                    }
                    else if (billingFreqTime == "months") {
                        total = BillingFreqQty / 3;
                    }
                    else if (billingFreqTime == "weeks") {
                        total = BillingFreqQty / 13;
                    }
                    else if (billingFreqTime == "days") {
                        total = BillingFreqQty / 90;
                    }
                    break;
                case "months":
                    if (billingFreqTime == "years") {
                        total = BillingFreqQty * 12;
                    }
                    else if (billingFreqTime == "quarters") {
                        total = BillingFreqQty * 4;
                    }
                    else if (billingFreqTime == "weeks") {
                        total = BillingFreqQty / 4.34524;
                    }
                    else if (billingFreqTime == "days") {
                        total = BillingFreqQty / 30.4167;
                    }
                    break;
                case "weeks":
                    if (billingFreqTime == "years") {
                        total = BillingFreqQty * 52.1429;
                    }
                    else if (billingFreqTime == "quarters") {
                        total = BillingFreqQty / 13;
                    }
                    else if (billingFreqTime == "months") {
                        total = BillingFreqQty / 4.34524;
                    }
                    else if (billingFreqTime == "days") {
                        total = BillingFreqQty / 7;
                    }
                    break;
                case "days":
                    if (billingFreqTime == "years") {
                        total = BillingFreqQty * 365;
                    }
                    else if (billingFreqTime == "quarters") {
                        total = BillingFreqQty * 90;
                    }
                    else if (billingFreqTime == "months") {
                        total = BillingFreqQty * 30.4167;
                    }
                    else if (billingFreqTime == "weeks") {
                        total = BillingFreqQty * 7;
                    }
                    break;
                default:
                    total = 0;
            }
            return total;
        }
        function getBillingFreqQtyInMonths(timeUnit, qty) {
            if (timeUnit == "months") {
                return qty;
            }
            else if (timeUnit == "years") {
                return qty * 12;
            }
            else if (timeUnit == "quarters") {
                return qty * 6;
            }
            else if (timeUnit == "quarters") {
                return qty * 6;
            }
            else {
                return null;
            }
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });