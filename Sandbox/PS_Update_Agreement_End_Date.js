function PS_VL_Update_Agreement_End_Date(type) {
    try {
        if (type == 'item') {
            var context = nlapiGetContext();
            var dateFormat = context.getPreference("dateformat");
            var agreementCreated = nlapiGetFieldValue('custbody_ps_agreement');
            if (!agreementCreated) {
                var itemId = nlapiGetCurrentLineItemValue('item', 'item');
                if (itemId) {
                    var subscriptionItem = nlapiLookupField('item', itemId, 'custitem_ps_agreement_item');
                    //if (subscriptionItem == '1') { //1 - SUBSCRIPTION ITEM || 2 - USAGE ITEM
                        var contractTerm = nlapiGetFieldValue('custbody_ps_contract_term');
                        if (contractTerm) {
                            var agreementFrequency = nlapiLookupField('customrecord_ps_agreement_frequency', contractTerm, ['custrecord_ps_ct_time', 'custrecord_ps_ct_quantity']);
                            if (agreementFrequency) {
                                // console.log(agreementFrequency);
                                var agreementStartDate = nlapiGetCurrentLineItemValue('item', 'custcol_ps_agreement_start_date');
                                if (agreementStartDate) {
                                    // console.log(agreementStartDate);
                                    var momentAgreeStartDate = moment(agreementStartDate, dateFormat);
                                    // console.log(momentAgreeStartDate);
                                    var momentAgreeEndDate = calculateAgreementEndDate(momentAgreeStartDate, agreementFrequency);
                                    if (momentAgreeEndDate) {
                                        // console.log(momentAgreeEndDate);
                                        var agreementEndDate = moment(momentAgreeEndDate).format(dateFormat);
                                        // console.log(agreementEndDate);
                                        nlapiSetCurrentLineItemValue('item', 'custcol_ps_agreement_end_date', agreementEndDate);
                                    }
                                }
                            }
                        }
                    //}
                }
            }
            return true;
        }
    }
    catch (error) {
        console.log(error);
    }
}

function PS_BS_Update_Agreement_End_Date(type) {
    try {
        if (type == 'create' || type == 'edit') {
            var newRecord = nlapiGetNewRecord();
            var context = nlapiGetContext();
            var dateFormat = context.getPreference("dateformat");
            if (newRecord) {
                var agreementCreated = newRecord.getFieldValue('custbody_ps_agreement');
                if (!agreementCreated) {
                    var contractTerm = newRecord.getFieldValue('custbody_ps_contract_term');
                    if (contractTerm) {
                        var agreementFrequency = nlapiLookupField('customrecord_ps_agreement_frequency', contractTerm, ['custrecord_ps_ct_time', 'custrecord_ps_ct_quantity']);
                        if (agreementFrequency) {
                            var itemLineCount = newRecord.getLineItemCount('item');
                            if (itemLineCount > 0) {
                                for (var i = 1; i <= itemLineCount; i++) {
                                    var itemId = newRecord.getLineItemValue('item', 'item', i);
                                    if (itemId) {
                                        var subscriptionItem = nlapiLookupField('item', itemId, 'custitem_ps_agreement_item');
                                       // if (subscriptionItem == '1') { //1 - SUBSCRIPTION ITEM || 2 - USAGE ITEM
                                            var agreementStartDate = newRecord.getLineItemValue('item', 'custcol_ps_agreement_start_date', i);
                                            if (agreementStartDate) {
                                                var momentAgreeStartDate = moment(agreementStartDate, dateFormat);
                                                var momentAgreeEndDate = calculateAgreementEndDate(momentAgreeStartDate, agreementFrequency);
                                                if (momentAgreeEndDate) {
                                                    var agreementEndDate = moment(momentAgreeEndDate).format(dateFormat);
                                                    newRecord.setLineItemValue('item', 'custcol_ps_agreement_end_date', i, agreementEndDate);
                                                }
                                            }
                                       // }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        nlapiLogExecution('ERROR', 'PS_BS_Update_Agreement_End_Date', JSON.stringify(error));
    }
}

function calculateAgreementEndDate(momentAgreeStartDate, agreementFrequency) {
    try {
        var time = agreementFrequency.custrecord_ps_ct_time;
        var quantity = agreementFrequency.custrecord_ps_ct_quantity;
        var momentAgreeEndDate;
        if (time && quantity) {
            var timeUnit;
            if (time == '1') { //MINUTES
                timeUnit = 'minutes';
            }
            else if (time == '2') { //HOURS
                timeUnit = 'hours';
            }
            else if (time == '3') { //DAY
                timeUnit = 'days';
            }
            else if (time == '4') { //MONTH
                timeUnit = 'months';
            }
            else if (time == '5') { //QUARTER
                timeUnit = 'quarters';
            }
            else if (time == '6') { //YEAR
                timeUnit = 'years';
            }

            momentAgreeEndDate = momentAgreeStartDate.add(quantity, timeUnit);
        }

        return momentAgreeEndDate;
    }
    catch (error) {
        nlapiLogExecution('ERROR', 'calculateAgreementEndDate', JSON.stringify(error));
    }
}