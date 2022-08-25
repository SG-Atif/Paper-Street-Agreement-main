/**
 * @NApiVersion 2.x
 * @NScriptType restlet
*/
 define(['N/log', 'N/search'],
 function(log, search) {
    function get(context) {
        log.debug({title: "Context", details: context});
        if(context.date){
            var data = getBillingScheduleData(context.date);
            log.debug({title: "Billing Scheudle Data", details: data});
            return JSON.stringify(data);
        }
        return "";
    }
    function getBillingScheduleData(date){
        var scheduleData = [];
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement_billing_sc_tr",
            filters:
            [
               ["custrecord_ps_abst_agreement_billing_sch.custrecord_ps_abs_date","on", date]
            ],
            columns:
            [
               search.createColumn({
                  name: "custrecord_ps_abst_agreement",
                  summary: "GROUP",
                  label: "Agreement"
               }),
               search.createColumn({
                  name: "internalid",
                  join: "CUSTRECORD_PS_ABST_AGREEMENT",
                  summary: "GROUP",
                  label: "Internal ID"
               })
            ]
        });
        agreementSrch.run().each(function(result){
            scheduleData.push({ 
                id: result.getValue({name: "internalid",join: "CUSTRECORD_PS_ABST_AGREEMENT",summary: "GROUP",label: "Internal ID"}), 
                parentId: null,
                name: result.getText({name: "custrecord_ps_abst_agreement",summary: "GROUP",label: "Agreement"}),
                lineName: "",
                amount : "",
                nextBillingDate: "",
            });
            return true;
        });
        if(scheduleData && scheduleData.length > 0){
            var billingTranSrch = search.create({
                type: "customrecord_ps_agreement_billing_sc_tr",
                filters:
                [
                   ["custrecord_ps_abst_agreement_billing_sch.custrecord_ps_abs_date","within", date]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_abst_agreement", label: "Agreement"}),
                   search.createColumn({name: "custrecord_ps_abst_agreement_billing_sch", label: "Agreement Billing Schedule"}),
                   search.createColumn({name: "custrecord_ps_abst_agreement_detail", label: "Agreement Detail"}),
                   search.createColumn({name: "custrecord_ps_abst_calculated_amount", label: "Calculated Amount"}),
                   search.createColumn({name: "custrecord_ps_aad_item", join: "CUSTRECORD_PS_ABST_AGREEMENT_DETAIL", label: "Item"}),
                   search.createColumn({name: "custrecord_ps_aad_next_billing_date",join: "CUSTRECORD_PS_ABST_AGREEMENT_DETAIL",label: "Next Billing Date"})
                ]
            });
            billingTranSrch.run().each(function(result){
                scheduleData.push({ 
                    id: result.getValue({name: "internalid", label: "Internal ID"}), 
                    parentId: result.getValue({name: "custrecord_ps_abst_agreement", label: "Agreement"}),
                    name: result.getValue({name: "custrecord_ps_abst_agreement", label: "Agreement"}),
                    lineName: result.getValue({name: "custrecord_ps_abst_agreement_detail", label: "Agreement Detail"})+" - "+result.getText({name: "custrecord_ps_aad_item", join: "CUSTRECORD_PS_ABST_AGREEMENT_DETAIL", label: "Item"}),
                    amount: result.getValue({name: "custrecord_ps_abst_calculated_amount", label: "Calculated Amount"}),
                    nextBillingDate: result.getValue({name: "custrecord_ps_aad_next_billing_date",join: "CUSTRECORD_PS_ABST_AGREEMENT_DETAIL",label: "Next Billing Date"}),
                });
                return true;
            });
        }
        return scheduleData;
    }

    return {
        get: get
    };
 });