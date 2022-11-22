/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
 define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record', 'N/format', 'N/redirect', 'N/runtime', './moment.min.js', 'N/url'],
 function (serverWidget, log, search, record, format, redirect, runtime, moment, url) {
     function onRequest(context) {
         try {
             var isErrorPage = false;
             var currentUserObj = runtime.getCurrentUser();
             var dateFormat = currentUserObj.getPreference({
                 name: 'dateformat'
             });
             var form = serverWidget.createForm({
                 title: 'Agreement',
                 hideNavBar: false
             });
             form.clientScriptModulePath = './PS_CS_Agreement_Page_Helper.js';
             var fileURLs = getFileUrl();
             log.debug({ title: "File URLs", details: JSON.stringify(fileURLs) });
             if (context.request.method === 'GET') {
                 var apiRestletUrl = url.resolveScript({
                     scriptId: "customscript_ps_rl_agreement_api",
                     deploymentId: "customdeploy_ps_rl_agreement_api",
                     returnExternalURL: false
                 });
                 var suiteletUrl = url.resolveScript({
                     scriptId: "customscript_ps_sl_agreement_page",
                     deploymentId: "customdeploy_ps_sl_agreement_page",
                     returnExternalURL: false
                 });
                 var cancellationSuiteletURL = url.resolveScript({
                     scriptId: "customscript_ps_sl_agreement_cancellatio",
                     deploymentId: "customdeploy_ps_sl_agreement_cancellatio",
                     returnExternalURL: false
                 });
                 var agreementId = context.request.parameters.agreementId;
                 var recordMode = context.request.parameters.context;
                 log.debug({ title: "Agreement Id | Context", details: agreementId + " | " + recordMode });
                 form.addField({
                     id: 'custpage_cancellation_sl',
                     type: serverWidget.FieldType.TEXT,
                     label: 'Cancellation Suitelet'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = cancellationSuiteletURL + "&agreementId=" + agreementId;
                 form.addField({
                     id: 'custpage_context',
                     type: serverWidget.FieldType.TEXT,
                     label: 'Record Mode'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = recordMode;
                 form.addField({
                     id: 'custpage_api_url',
                     type: serverWidget.FieldType.TEXT,
                     label: 'API URL'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = apiRestletUrl;
                 form.addField({
                     id: 'custpage_suitelet_url',
                     type: serverWidget.FieldType.TEXT,
                     label: 'Suitelet URL'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = suiteletUrl;
                 form.addField({
                     id: 'custpage_page_loader',
                     type: serverWidget.FieldType.TEXT,
                     label: 'Page Loader'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = fileURLs.pageLoader;
                 form.addField({
                     id: 'custpage_pref_date_format',
                     type: serverWidget.FieldType.TEXT,
                     label: 'Date Format'
                 }).updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.HIDDEN
                 }).defaultValue = dateFormat;
                 if ((recordMode == "edit" && isEmpty(agreementId))
                     || (recordMode == "view" && isEmpty(agreementId))
                     || isEmpty(recordMode)) {
                     isErrorPage = true;
                 }
                 else if (recordMode == "create") {
                     agreementId = "";
                     form.addField({
                         id: 'custpage_agreement_id',
                         type: serverWidget.FieldType.TEXT,
                         label: 'Agreement Id'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = agreementId;
                     form.addField({
                         id: 'custpage_agreement_detail',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Agreement Detail'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = "";
                 }
                 else if (agreementId) {
                     form.addField({
                         id: 'custpage_agreement_id',
                         type: serverWidget.FieldType.TEXT,
                         label: 'Agreement Id'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = agreementId;
                     var agreementDetailString = getAgreementDetails(agreementId);
                     log.debug({ title: "Agreement Object", details: agreementDetailString });
                     if (agreementDetailString) {
                         form.addField({
                             id: 'custpage_agreement_detail',
                             type: serverWidget.FieldType.LONGTEXT,
                             label: 'Agreement Detail'
                         }).updateDisplayType({
                             displayType: serverWidget.FieldDisplayType.HIDDEN
                         }).defaultValue = JSON.stringify(agreementDetailString);
                     }
                     else {
                         isErrorPage = true;
                     }
                 }
                 else {
                     isErrorPage = true;
                 }
                 /**********************
                 * Fields To Store Data
                 **********************/
                 if (isErrorPage == false) {
                    //  form.addField({
                    //      id: 'custpage_customer_list',
                    //      type: serverWidget.FieldType.LONGTEXT,
                    //      label: 'Customer List'
                    //  }).updateDisplayType({
                    //      displayType: serverWidget.FieldDisplayType.HIDDEN
                    //  }).defaultValue = [];//getCustomers();
                     form.addField({
                        id: 'custpage_customer_list',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Customer List'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = getCustomers();
                     form.addField({
                         id: 'custpage_subsidiary_list',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Subsidiary List'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getSubsidiaries();
                     form.addField({
                         id: 'custpage_currency_list',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Currency List'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getCurrencies();
                     form.addField({
                         id: 'custpage_agreement_status_list',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Agreement Status List'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getAgreementStatus();
                     form.addField({
                         id: 'custpage_contract_term_list',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Contract Term List'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getContractTerms();
                     form.addField({
                         id: 'custpage_payment_method_list',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Payment Method List'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getPaymentMethods();
                     form.addField({
                         id: 'custpage_line_items',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Line Items'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getLineItems();
                     form.addField({
                         id: 'custpage_line_billingfrequency',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Billing Frequency'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getBillingFrequency();
                     form.addField({
                         id: 'custpage_line_agreementtypes',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Agreement Item Types'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getAgreementItemTypes();
                     form.addField({
                         id: 'custpage_line_pricelevels',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Price Levels'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getPriceLevels();
                     form.addField({
                         id: 'custpage_line_pricetypes',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Price types'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getPriceTypes();
                     form.addField({
                         id: 'custpage_line_usagegroups',
                         type: serverWidget.FieldType.LONGTEXT,
                         label: 'Usage Groups'
                     }).updateDisplayType({
                         displayType: serverWidget.FieldDisplayType.HIDDEN
                     }).defaultValue = getUsageGroup();
                     /**********************
                     * HTML Fields
                     **********************/
                     form.addField({
                         id: 'custpage_fld_html',
                         type: serverWidget.FieldType.INLINEHTML,
                         label: 'Html Control'
                     }).defaultValue = '<iframe id="agreement" scrolling="no" seamless="seamless" style="margin-bottom: 10px;margin-top: -10px;min-height: 500px;display: block;  width: 100%; border: none;" src="' + fileURLs.htmlControl + '"></iframe>';
                 }
                 else {
                     form.addField({
                         id: 'custpage_fld_html',
                         type: serverWidget.FieldType.INLINEHTML,
                         label: 'Error Control'
                     }).defaultValue = '<iframe id="agreement" scrolling="no" seamless="seamless" style="margin-top: -10px;min-height: 500px;display: block;  width: 100%; border: none;" src="' + fileURLs.errorPage + '"></iframe>';
                 }
             }
             context.response.writePage(form);
         }
         catch (error) {
             log.error({ title: "Error| Suitelet GET Request", details: error });
         }
     }
     /**********************
      * Helper Functions****
     **********************/
     function getFileUrl() {
         var response = {
             htmlControl: "",
             agreementIcon: "",
             pageLoader: "",
             errorPage: ""
         }
         var fileSrch = search.create({
             type: "file",
             filters:
                 [
                     ["name", "is", "AgreementControl.html"],
                     "OR",
                     ["name", "is", "memo.png"],
                     "OR",
                     ["name", "is", "Loader.gif"],
                     "OR",
                     ["name", "is", "ErrorPage.html"],
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "url", label: "URL" })
                 ]
         });
         fileSrch.run().each(function (result) {
             var fileName = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             if (fileName == "AgreementControl.html") {
                 response.htmlControl = result.getValue({ name: "url", label: "URL" });
             }
             else if (fileName == "memo.png") {
                 response.agreementIcon = result.getValue({ name: "url", label: "URL" });
             }
             else if (fileName == "Loader.gif") {
                 response.pageLoader = result.getValue({ name: "url", label: "URL" });
             }
             else if (fileName == "ErrorPage.html") {
                 response.errorPage = result.getValue({ name: "url", label: "URL" });
             }
             return true;
         });
         return response;
     }
     function getCustomers() {
         var optionString = "<option value=''></option>";
         var customerSrch = search.create({
             type: "customer",
             filters:
                 [
                    ["isinactive", "is", "F"], 
                    "AND", 
                    ["stage","anyof","CUSTOMER"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     //search.createColumn({ name: "altname", sort: search.Sort.ASC, label: "Name"}),
                     search.createColumn({ name: "entityid", sort: search.Sort.ASC, label: "Name Id" }),
                     search.createColumn({ name: "subsidiarynohierarchy", label: "Primary Subsidiary (no hierarchy)" })
                 ]
         });
         var id, nameId, name, subsidiary;
         var customerSrchResultSet = customerSrch.run()
         var currentRange = customerSrchResultSet.getRange({
            start : 0,
            end : 1000
        });
        var i = 0;
        var j = 0;
        var result;
        while ( j < currentRange.length ) {
            result = currentRange[j];
            id = result.getValue({ name: "internalid", label: "Internal ID" });
            name = "";//result.getValue({ name: "altname", sort: search.Sort.ASC, label: "Name"});
            nameId = result.getValue({ name: "entityid", sort: search.Sort.ASC, label: "Name Id" });
            subsidiary = result.getValue({ name: "subsidiarynohierarchy", label: "Primary Subsidiary (no hierarchy)" });
            optionString = optionString + "<option value='" + id + "' data-subsidiary=" + subsidiary + ">"
            optionString = optionString + nameId +" "+name + "</option>";
            i++; j++;
            if( j == 1000 ) {
                j = 0;   
                currentRange = customerSrchResultSet.getRange({
                    start : i,
                    end : i + 1000
                });
            }
        }
        return optionString;
     }
     function getSubsidiaries() {
         var optionString = "<option value=''></option>";
         var subSrch = search.create({
             type: "subsidiary",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", label: "Name" }),
                     search.createColumn({ name: "namenohierarchy", label: "Name (no hierarchy)" }),
                 ]
         });
         var id, name;
         subSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getCurrencies() {
         var optionString = "<option value=''></option>";
         var currencySrch = search.create({
             type: "currency",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "symbol", label: "Symbol" })
                 ]
         });
         var id, name;
         currencySrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getAgreementStatus() {
         var optionString = "<option value=''></option>";
         var agreementStatusDrch = search.create({
             type: "customrecord_ps_agreement_status",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" })
                 ]
         });
         var id, name;
         agreementStatusDrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getContractTerms() {
         var optionString = "<option value=''></option>";
         var agreementFreqSrch = search.create({
             type: "customrecord_ps_agreement_frequency",
             filters:
                 [
                     ["isinactive", "is", "F"],
                     "AND",
                     ["custrecord_ps_contract_term", "is", "T"],
                     "AND",
                     ["custrecord_ps_subsidiary", "noneof", "@NONE@"],
                     "AND",
                     ["custrecord_ps_agreement_preference", "noneof", "@NONE@"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "custrecord_ps_subsidiary", label: "Subsidiary" }),
                     search.createColumn({ name: "custrecord_ps_agreement_preference", label: "Agreement Preference" })
                 ]
         });
         var id, name, subsidiary, preferenceId;
         agreementFreqSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             subsidiary = result.getValue({ name: "custrecord_ps_subsidiary", label: "Subsidiary" });
             preferenceId = result.getValue({ name: "custrecord_ps_agreement_preference", label: "Agreement Preference" });
             optionString = optionString + "<option data-subsidiary='" + subsidiary + "' data-prefid='" + preferenceId + "' value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getPaymentMethods() {
         var optionString = "<option value=''></option>";
         var paymentMethodSrch = search.create({
             type: "paymentmethod",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" })
                 ]
         });
         var id, name;
         paymentMethodSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getLineItems() {
         var optionString = "<option value=''></option>";
         var itemSrch = search.create({
             type: "item",
             filters:
                 [
                     ["isinactive", "is", "F"],
                     "AND",
                     ["custitem_ps_agreement_item", "noneof", "@NONE@"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "custitem_ps_agreement_item", label: "Agreement Item" }),
                     search.createColumn({ name: "subsidiary", label: "Subsidiary" }),
                     search.createColumn({ name: "type", label: "Type" }),
                     search.createColumn({ name: "includechildren", label: "Include Children" })
                 ]
         });
         var id, name, type, agreementType, subsidiary, includeChildren;
         itemSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "itemid", sort: search.Sort.ASC, label: "Name" });
             type = result.getValue({ name: "type", label: "Type" });
             subsidiary = result.getValue({ name: "subsidiary", label: "Subsidiary" });
             agreementType = result.getValue({ name: "custitem_ps_agreement_item", label: "Agreement Item" });
             includeChildren = result.getValue({ name: "includechildren", label: "Include Children" });
             optionString = optionString + "<option data-inclduechildren='" + includeChildren + "' data-subsidiary='" + subsidiary + "' data-agreementtype='" + agreementType + "' data-type='" + type + "' value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getBillingFrequency() {
         var optionString = "<option value=''></option>";
         var agreementFreqSrch = search.create({
             type: "customrecord_ps_agreement_frequency",
             filters:
                 [
                     ["isinactive", "is", "F"],
                     "AND",
                     ["custrecord_ps_billing_term", "is", "T"],
                     "AND",
                     ["custrecord_ps_subsidiary", "noneof", "@NONE@"],
                     "AND",
                     ["custrecord_ps_agreement_preference", "noneof", "@NONE@"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "custrecord_ps_subsidiary", label: "Subsidiary" }),
                     search.createColumn({ name: "custrecord_ps_agreement_preference", label: "Agreement Preference" })
                 ]
         });
         var id, name, subsidiary, preferenceId;
         agreementFreqSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             subsidiary = result.getValue({ name: "custrecord_ps_subsidiary", label: "Subsidiary" });
             preferenceId = result.getValue({ name: "custrecord_ps_agreement_preference", label: "Agreement Preference" });
             optionString = optionString + "<option data-subsidiary='" + subsidiary + "' data-prefid='" + preferenceId + "' value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getAgreementItemTypes() {
         var optionString = "<option value=''></option>";
         var agreementTypeSrch = search.create({
             type: "customrecord_ps_agreement_type",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" })
                 ]
         });
         var id, name;
         agreementTypeSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getPriceLevels() {
         var optionString = "<option value=''></option>";
         var agreementTypeSrch = search.create({
             type: "customrecord_ps_agreement_pricing",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                     search.createColumn({ name: "custrecord_ps_req_agreement_pricing_type" })
                 ]
         });
         var id, name, priceType;
         agreementTypeSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             priceType = result.getValue({ name: "custrecord_ps_req_agreement_pricing_type" });
             optionString = optionString + "<option data-pricetype='" + priceType + "' value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getPriceTypes() {
         var optionString = "<option value=''></option>";
         var agreementTypeSrch = search.create({
             type: "customlist_ps_agreement_pricing_type",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                     search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" })
                 ]
         });
         var id, name;
         agreementTypeSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
             optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
             return true;
         });
         return optionString;
     }
     function getUsageGroup() {
         var optionString = "<option value=''></option>";
         var agreementTypeSrch = search.create({
             type: "customrecord_ps_agreement_group",
             filters:
                 [
                     ["isinactive", "is", "F"]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Internal ID" }),
                 ]
         });
         var id;
         agreementTypeSrch.run().each(function (result) {
             id = result.getValue({ name: "internalid", label: "Internal ID" });
             optionString = optionString + "<option value='" + id + "'>" + id + "</option>"
             return true;
         });
         return optionString;
     }
     function isEmpty(value) {
         if (value == null || value == NaN || value == 'null' || value == undefined || value == 'undefined' || value == '' || value == "" || value.length <= 0) { return true; }
         return false;
     }
     function getAgreementDetails(agreementId) {
         try {
             var agreementDetails = null;
             var agreementSrch = search.create({
                 type: "customrecord_ps_agreement",
                 filters:
                     [
                         ["isinactive", "is", "F"],
                         "AND",
                         ["internalid", "anyof", agreementId],
                         "AND",
                         [["custbody_ps_agreement.internalid", "anyof", "@NONE@"], "OR", ["custbody_ps_agreement.mainline", "is", "T"]]
                     ],
                 columns:
                     [
                         search.createColumn({ name: "internalid", summary: "GROUP", label: "Id" }),
                         search.createColumn({ name: "custrecord_ps_a_customer", summary: "GROUP", label: "Customer" }),
                         search.createColumn({ name: "custrecord_ps_a_subsidiary", summary: "GROUP", label: "Subsidiary" }),
                         search.createColumn({ name: "custrecord_ps_a_currency", summary: "MAX", label: "Currency" }),
                         search.createColumn({ name: "custrecord_ps_a_agreement_start", summary: "MAX", label: "Start Date" }),
                         search.createColumn({ name: "custrecord_ps_a_agreement_end_date", summary: "MAX", label: "End Date" }),
                         search.createColumn({ name: "custrecord_ps_a_contract_term", summary: "GROUP", label: "Term" }),
                         search.createColumn({ name: "custrecord_ps_a_payment_method", summary: "GROUP", label: "Payment Method" }),
                         search.createColumn({ name: "custrecord_ps_a_required_monthly_min", summary: "MAX", label: "Required Minimum" }),
                         search.createColumn({ name: "created", summary: "MAX", label: "Date Created" }),
                         search.createColumn({ name: "custrecord_ps_a_evergreen", summary: "MAX", label: "Evergreen" }),
                         search.createColumn({ name: "custrecord_ps_a_status", summary: "MAX", label: "Status" }),
                         search.createColumn({
                             name: "formulatext",
                             summary: "MAX",
                             formula: "'['||ns_concat( distinct '{\"id\":\"'||{custbody_ps_agreement.internalid}||'\",\"currency\":\"'||{custbody_ps_agreement.currency}||'\",\"recordType\":\"'||{custbody_ps_agreement.recordtype}||'\",\"status\":\"'||{custbody_ps_agreement.status}||'\",\"fxamount\":\"'||{custbody_ps_agreement.fxamount}||'\",\"amount\":\"'||{custbody_ps_agreement.amount}||'\",\"type\":\"'||{custbody_ps_agreement.type}||'\",\"documentNumber\":\"'||{custbody_ps_agreement.number}||'\",\"date\":\"'||{custbody_ps_agreement.trandate}||'\"}')||']'",
                             label: "Transaction Data"
                         }),
                         search.createColumn({
                             name: "formulatext",
                             summary: "MAX",
                             formula: "'['||ns_concat( distinct '{\"id\":\"'||{custrecord_ps_ac_agreement.internalid}||'\",\"agreement\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_agreement}||'\",\"agreementLineId\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_as_agreement_detail}||'\",\"renewedAgreement\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_renewed_agreement}||'\",\"event\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_concluding_event}||'\",\"effectiveDate\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_ac_effective_date}||'\",\"reason\":\"'||{custrecord_ps_ac_agreement.custrecord_ps_concluding_event_reason}||'\"}')||']'",
                             label: "Conclusion Event"
                         })
                     ]
             });
             var transactionList, conclusionList;
             agreementSrch.run().each(function (result) {
                 agreementDetails = {};
                 log.debug({ title: "JSON string", details: result.getValue(result.columns[13]) });
                 transactionList = result.getValue(result.columns[12]) ? JSON.parse(result.getValue(result.columns[12])) : [];
                 conclusionList = result.getValue(result.columns[13]) ? JSON.parse(result.getValue(result.columns[13])) : [];
                 if (transactionList && transactionList.length > 0) {
                     if (isEmpty(transactionList[0].id)) {
                         transactionList = [];
                     }
                 }
                 if (conclusionList && conclusionList.length > 0) {
                     if (isEmpty(conclusionList[0].id)) {
                         conclusionList = [];
                     }
                 }
                 agreementDetails = {
                     id: result.getValue({ name: "internalid", summary: "GROUP", label: "Id" }),
                     customerId: result.getValue({ name: "custrecord_ps_a_customer", summary: "GROUP", label: "Customer" }),
                     subsidiaryId: result.getValue({ name: "custrecord_ps_a_subsidiary", summary: "GROUP", label: "Subsidiary" }),
                     currency: result.getValue({ name: "custrecord_ps_a_currency", summary: "MAX", label: "Currency" }),
                     startDate: result.getValue({ name: "custrecord_ps_a_agreement_start", summary: "MAX", label: "Start Date" }),
                     endDate: result.getValue({ name: "custrecord_ps_a_agreement_end_date", summary: "MAX", label: "End Date" }),
                     termId: result.getValue({ name: "custrecord_ps_a_contract_term", summary: "GROUP", label: "Term" }),
                     paymentMethodId: result.getValue({ name: "custrecord_ps_a_payment_method", summary: "GROUP", label: "Payment Method" }),
                     requiredMinimum: result.getValue({ name: "custrecord_ps_a_required_monthly_min", summary: "MAX", label: "Required Minimum" }),
                     createdDate: result.getValue({ name: "created", summary: "MAX", label: "Date Created" }),
                     isEvergreen: result.getValue({ name: "custrecord_ps_a_evergreen", summary: "MAX", label: "Evergreen" }),
                     status: result.getValue({ name: "custrecord_ps_a_status", summary: "MAX", label: "Status" }),
                     lines: getAgreementDetailLines(agreementId),
                     conclusionEvents: conclusionList,
                     transactions: transactionList,
                 };
             });
         }
         catch (exp) {
             log.error({ title: "Error while fetching agreement data. | getAgreements", details: JSON.stringify(exp) });
             agreementDetails = "";
         }
         return agreementDetails;
     }
     function getAgreementDetailLines(agreementId) {
         var lines = [];
         var agreementLineSrch = search.create({
             type: "customrecord_ps_agreement_details",
             filters:
                 [
                     ["isinactive", "is", "F"],
                     "AND",
                     ["custrecord_ps_aad_agreement", "anyof", agreementId]
                 ],
             columns:
                 [
                     search.createColumn({ name: "internalid", label: "Id" }),
                     search.createColumn({ name: "custrecord_ps_aad_item", label: "Item" }),
                     search.createColumn({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
                     search.createColumn({ name: "custrecord_ps_aad_amount", label: "Amount" }),
                     search.createColumn({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                     search.createColumn({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                     search.createColumn({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                     search.createColumn({ name: "custrecord_ps_aad_next_renewal_date", label: "Renewal Date" }),
                     search.createColumn({ name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date" }),
                     search.createColumn({ name: "custrecord_ps_aad_status", label: "Status" }),
                     search.createColumn({ name: "custrecord_ps_aad_agreement_type", label: "Agreement Type" }),
                     search.createColumn({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                     search.createColumn({ name: "custrecord_ps_aad_pricing_type", label: "Price Type" }),
                     search.createColumn({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                     search.createColumn({ name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key" }),
                     search.createColumn({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency" }),
                     search.createColumn({ name: "custrecord_ps_aad_rate", label: "Rate" }),
                     search.createColumn({ name: "custrecord_ps_aad_required_minimum", label: "Required Minimum" }),
                     search.createColumn({ name: "custrecord_ps_aad_usage_group", label: "Usage Group" }),
                 ]
         });
         agreementLineSrch.run().each(function (result) {
             lines.push({
                 id: result.getValue({ name: "internalid", label: "Id" }),
                 item: result.getText({ name: "custrecord_ps_aad_item", label: "Item" }),
                 itemId: result.getValue({ name: "custrecord_ps_aad_item", label: "Item" }),
                 quantity: result.getValue({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
                 amount: result.getValue({ name: "custrecord_ps_aad_amount", label: "Amount" }),
                 startDate: result.getValue({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                 endDate: result.getValue({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                 nextBillingDate: result.getValue({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                 renewalDate: result.getValue({ name: "custrecord_ps_aad_next_renewal_date", label: "Renewal Date" }),
                 lastBillingDate: result.getValue({ name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date" }),
                 status: result.getText({ name: "custrecord_ps_aad_status", label: "Status" }),
                 agreementLineType: result.getText({ name: "custrecord_ps_aad_agreement_type", label: "Agreement Type" }),
                 priceLevel: result.getText({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                 priceLevelId: result.getValue({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                 agreementPricingType: result.getText({ name: "custrecord_ps_aad_pricing_type", label: "Price Type" }),
                 createdFromTransactionId: result.getValue({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                 createdFromTransaction: result.getText({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                 transactionLineUniqueKey: result.getValue({ name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key" }),
                 billingFrequency: result.getText({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency" }),
                 rate: result.getValue({ name: "custrecord_ps_aad_rate", label: "Rate" }),
                 requiredMinimum: result.getValue({ name: "custrecord_ps_aad_required_minimum", label: "Required Minimum" }),
                 usageGroup: result.getValue({ name: "custrecord_ps_aad_usage_group", label: "Usage Group" }),
             });
             return true;
         });
         return lines;
     }

     return {
         onRequest: onRequest
     }
 });