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
              
            }
            catch(error){
                log.error({ title : "Error on after submit", details : JSON.stringify(error) });
            }
        }
    }
    /**********************
     * Helper Functions****
     **********************/
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

    return {
        afterSubmit: afterSubmit,
    }
});