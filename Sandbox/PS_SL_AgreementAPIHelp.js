/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
 define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record','N/url','N/runtime'], 
 function(serverWidget, log, search, record, url, runtime) {
    function onRequest(context){
        if(context.request.method === 'GET'){
          var form = serverWidget.createForm({
              title: 'Agreement API',
              hideNavBar: true
          });
          var fileURLs = getFileUrl();
          log.debug({title: "File URLs", details: fileURLs});
          /*************************
           * Server side fields
           **********************/
           form.addField({
            id: 'custpage_inline_css',
            type: serverWidget.FieldType.INLINEHTML,
            label: 'HTML Field'
          }).defaultValue = '<style>.uir-page-title {display:none;}</style>';
            form.addField({
              id: 'custpage_inline_html',
              type: serverWidget.FieldType.INLINEHTML,
              label: 'HTML Field'
            }).defaultValue = '<iframe scrolling="no" seamless="seamless" style="margin-top: -8px;height: 4300px;display: block;  width: 100%; border: none;" src="'+fileURLs.htmlControl+'"></iframe>';
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
                ["name","is","AgreementAPIDocumentation.html"]
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
            if(fileName == "AgreementAPIDocumentation.html"){
                response.htmlControl = result.getValue({name: "url", label: "URL"});
            }
            return true;
        });
        return response;
    }
    return {
        onRequest: onRequest
    }
});