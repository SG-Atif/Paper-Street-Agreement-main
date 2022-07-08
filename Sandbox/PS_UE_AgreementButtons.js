/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/url'], 
 function(log, url) {
    function beforeLoad(context) {
        log.debug({title : "Button script triggered.", details : context.type});
        if (context.type == "view") {
            try{
                var id = context.newRecord.id;
                var status = context.newRecord.getValue({
                    fieldId : "custrecord_ps_a_status"
                });
                log.debug({title : "Status", details : status});
                if(status != "3"){
                    var suiteletURL = url.resolveScript({
                        scriptId: "customscript_ps_sl_agreement_cancellatio",
                        deploymentId: "customdeploy_ps_sl_agreement_cancellatio",
                        returnExternalURL: false
                    });
                    suiteletURL = suiteletURL + "&agreementId=" + id;
                    log.debug({title : "Suitelet url", details : suiteletURL});
                    context.form.addButton({
                        id: 'custpage_agreement_cancellation',
                        label: 'Cancel Agreement',
                        functionName:  'window.open("'+suiteletURL+'", "_self")'
                    });
                }
            }
            catch(error){
                log.error({ title : "Error on before load", details : JSON.stringify(error) });
            }
        }
    }

    return {
        beforeLoad: beforeLoad
    }
});