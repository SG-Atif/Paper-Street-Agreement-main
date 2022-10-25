/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/search', 'N/record', './moment.min.js', 'N/redirect'], 
 function(log, search, record, moment, redirect) {
    
    function beforeLoad(context) {
        try{
            log.debug({ title: "Current Context", details : context.type });
            var currentRecId = context.newRecord.id;
            var contextType = context.type;
            var currentRecType = context.newRecord.type;
            log.debug({ title: "Record Type | Record Id | Context Type", details: currentRecType +" | "+currentRecId + " | " + contextType });
            if(currentRecType == "customrecord_ps_agreement"){
                if(contextType == "view"){
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_page',
                        parameters: {
                            'agreementId': currentRecId,
                            'context': contextType
                        }
                    });
                }
                else if(contextType == "edit"){
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_page',
                        parameters: {
                            'agreementId': currentRecId,
                            'context': contextType
                        }
                    });
                }
                else{
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_page',
                        parameters: {
                            'context': contextType
                        }
                    });
                }
            }
            else if(currentRecType == "customrecord_ps_agreement_details"){
                if(contextType == "view"){
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_line_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_line_page',
                        parameters: {
                            'lineId': currentRecId,
                            'context': contextType
                        }
                    });
                }
                else if(contextType == "edit"){
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_line_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_line_page',
                        parameters: {
                            'lineId': currentRecId,
                            'context': contextType
                        }
                    });
                }
                else{
                    redirect.toSuitelet({
                        scriptId: 'customscript_ps_sl_agreement_line_page',
                        deploymentId: 'customdeploy_ps_sl_agreement_line_page',
                        parameters: {
                            'context': contextType
                        }
                    });
                }
            }
        }
        catch(error){
            log.error({ title : "Error on before submit", details : JSON.stringify(error) });
        }
    }

    return {
        beforeLoad: beforeLoad,
    }
});