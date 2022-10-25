/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
 define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record','N/url','N/runtime'], 
 function(serverWidget, log, search, record, url, runtime) {
    function onRequest(context){
        if(context.request.method === 'GET'){
          var form = serverWidget.createForm({
              title: 'Agreement Billing Schedule',
              hideNavBar: true
          });
          var restletScriptUrl = url.resolveScript({
             scriptId: "customscript_ps_rl_agreement_billing_sch",
             deploymentId: "customdeploy_ps_rl_agreement_billing_sch",
             returnExternalURL: true
          });
          log.debug({title: "Restlet URL", details: restletScriptUrl});
          var fileURLs = getFileUrl();
          var currentUserObj = runtime.getCurrentUser();
          var dateFormat = currentUserObj.getPreference ({
            name: 'dateformat'
          });
          /*************************
           * Server side fields
           **********************/
            form.addField({
                id: 'custpage_subsidiary_list',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'Subsidiary List'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = getSubsidiaries();
            form.addField({
                id: 'custpage_customer_list',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'Customer List'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = getCustomers();
            form.addField({
                id: 'custpage_agreement_list',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'Agreement List'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = getAgreements();
            form.addField({
                id: 'custpage_restlet_url',
                type: serverWidget.FieldType.TEXT,
                label: 'Restlet URL'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = restletScriptUrl;
            form.addField({
                id: 'custpage_pref_date_format',
                type: serverWidget.FieldType.TEXT,
                label: 'Date Format'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = dateFormat;
            form.addField({
                id: 'custpage_agreement_icon',
                type: serverWidget.FieldType.TEXT,
                label: 'Agreement ICON'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = fileURLs.agreementIcon;
            form.addField({
                id: 'custpage_json_data',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'JSON Data'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            form.addField({
              id: 'custpage_inline_html',
              type: serverWidget.FieldType.INLINEHTML,
              label: 'HTML Field'
            }).defaultValue = '<iframe id="billingScheudleFrame" scrolling="no" seamless="seamless" style="min-height: 300px;display: block;  width: 100%; border: none;" src="'+fileURLs.htmlControl+'"></iframe>';
            context.response.writePage(form);
        }
    }
    /**********************
     * Helper Functions****
    **********************/
    function getFileUrl(){
        var response = {
            htmlControl : "",
            agreementIcon : ""
        }
        var fileSrch = search.create({
            type: "file",
            filters:
            [
               ["name","is","BillingScheduleControl.html"], 
               "OR", 
               ["name","is","memo.png"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"}),
               search.createColumn({name: "url", label: "URL"})
            ]
        });
        fileSrch.run().each(function(result){
            var fileName = result.getValue({name: "name",sort: search.Sort.ASC,label: "Name"});
            if(fileName == "BillingScheduleControl.html"){
                response.htmlControl = result.getValue({name: "url", label: "URL"});
            }
            else if(fileName == "memo.png"){
                response.agreementIcon = result.getValue({name: "url", label: "URL"});
            }
            return true;
        });
        return response;
    }
    function getSubsidiaries(){
        var optionString = "<option value=''></option>";
        var subSrch = search.create({
            type: "subsidiary",
            filters:
            [
               ["isinactive","is","F"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "namenohierarchy", label: "Name (no hierarchy)"}),
            ]
         });
         var id, name;
         subSrch.run().each(function(result){
            id = result.getValue({name: "internalid", label: "Internal ID"});
            name = result.getValue({name: "namenohierarchy", label: "Name (no hierarchy)"});
            optionString = optionString + "<option value='"+id+"'>"+name+"</option>"
            return true;
         });
         return optionString;
    }
    function getCustomers(){
        var optionString = "<option value=''></option>";
        var customerSrch = search.create({
            type: "customer",
            filters:
            [
               ["isinactive","is","F"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "entityid",sort: search.Sort.ASC,label: "Name"}),
               search.createColumn({name: "subsidiarynohierarchy", label: "Primary Subsidiary (no hierarchy)"})
            ]
         });
         var id, name, subsidiary;
         customerSrch.run().each(function(result){
            id = result.getValue({name: "internalid", label: "Internal ID"});
            name = result.getValue({name: "entityid",sort: search.Sort.ASC,label: "Name"}); 
            subsidiary = result.getValue({name: "subsidiarynohierarchy", label: "Primary Subsidiary (no hierarchy)"});
            optionString = optionString + "<option value='"+id+"' data-subsidiary="+subsidiary+">"
            optionString = optionString + name +"</option>"
            return true;
        });
        return optionString;
    }
    function getAgreements(){
        var optionString = "<option value=''></option>";
        var agreementSrch = search.create({
            type: "customrecord_ps_agreement",
            filters:
            [
               ["isinactive","is","F"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_a_customer", label: "Customer"}),
               search.createColumn({name: "custrecord_ps_a_subsidiary", label: "Subsidiary"})
            ]
         });
         var subsidiary, customer, id;
         agreementSrch.run().each(function(result){
            id = result.getValue({name: "internalid", label: "Internal ID"});
            subsidiary = result.getValue({name: "custrecord_ps_a_subsidiary", label: "Subsidiary"});
            customer = result.getValue({name: "custrecord_ps_a_customer", label: "Customer"});
            optionString = optionString + "<option value='"+id+"' data-subsidiary='"+subsidiary+"'  data-customer='"+customer+"'>";
            optionString = optionString + result.getValue({name: "internalid", label: "Internal ID"})+"</option>"
            return true;
         });
         return optionString;
    }
    return {
        onRequest: onRequest
    }
});