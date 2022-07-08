/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/log', 'N/ui/serverWidget'], 
 function(log, serverWidget) {
    function beforeLoad(context){
        try{
            var form = context.form;
            if(form){
                var agreementFld = form.getField("custrecord_ps_ac_agreement");
                //var agreementDetailFld = form.getField("custrecord_ps_as_agreement_detail");
                if(agreementFld){
                    agreementFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.INLINE
                    });
                }
                // if(agreementDetailFld){
                //     agreementDetailFld.updateDisplayType({
                //         displayType : serverWidget.FieldDisplayType.INLINE
                //     });
                // }
            }
        }
        catch(error){
            log.error({ title : "Error on before load", details : JSON.stringify(error) });
        }
    }

    return {
        beforeLoad : beforeLoad
    }
});