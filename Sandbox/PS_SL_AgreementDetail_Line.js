/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record', 'N/format', 'N/redirect', 'N/runtime', './moment.min.js','N/url'],
    function (serverWidget, log, search, record, format, redirect, runtime, moment, url) {
        function onRequest(context) {
            try{
                var isErrorPage = false;
                var currentUserObj = runtime.getCurrentUser();
                var dateFormat = currentUserObj.getPreference({
                    name: 'dateformat'
                });
                var form = serverWidget.createForm({
                    title: 'Agreement Line',
                    hideNavBar: false
                });
                form.clientScriptModulePath = './PS_CS_AgreementLine_Page_Helper';
                var fileURLs = getFileUrl();
                log.debug({title: "File URLs", details: JSON.stringify(fileURLs)});
                if (context.request.method === 'GET') {
                    var apiRestletUrl = url.resolveScript({
                        scriptId: "customscript_ps_rl_agreement_api",
                        deploymentId: "customdeploy_ps_rl_agreement_api",
                        returnExternalURL: false
                     });
                     var agreementSuitelet = url.resolveScript({
                        scriptId: "customscript_ps_sl_agreement_page",
                        deploymentId: "customdeploy_ps_sl_agreement_page",
                        returnExternalURL: false
                     });
                     var suiteletUrl = url.resolveScript({
                        scriptId: "customscript_ps_sl_agreement_line_page",
                        deploymentId: "customdeploy_ps_sl_agreement_line_page",
                        returnExternalURL: false
                     });
                     var cancellationSuiteletURL = url.resolveScript({
                        scriptId: "customscript_ps_sl_agreement_cancellatio",
                        deploymentId: "customdeploy_ps_sl_agreement_cancellatio",
                        returnExternalURL: false
                     });
                    var lineId = context.request.parameters.lineId;
                    var recordMode = context.request.parameters.context;
                    log.debug({ title: "Line Id | Context", details: lineId +" | "+ recordMode});
                    form.addField({
                        id: 'custpage_cancellation_sl',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Cancellation Suitelet'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = cancellationSuiteletURL + "&lineId=" + lineId;
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
                        id: 'custpage_agreement_suitelet_url',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Agreement Suitelet URL'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = agreementSuitelet;
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
                    form.addField({
                        id: 'custpage_agreements',
                        type: serverWidget.FieldType.LONGTEXT,
                        label: 'Agreements'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = getAgreements();
                    if((recordMode == "edit" && isEmpty(lineId))
                        || (recordMode == "view" && isEmpty(lineId))
                        || isEmpty(recordMode)){
                            isErrorPage = true;
                    }
                    else if(recordMode == "create"){
                        lineId = "";
                        form.addField({
                            id: 'custpage_agreement_line_id',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Agreement Line Id'
                        }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        }).defaultValue = lineId;
                        form.addField({
                            id: 'custpage_agreement_line_detail',
                            type: serverWidget.FieldType.LONGTEXT,
                            label: 'Agreement Line Detail'
                        }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        }).defaultValue = "";
                    }
                    else if(lineId){
                        form.addField({
                            id: 'custpage_agreement_line_id',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Agreement Line Id'
                        }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        }).defaultValue = lineId;
                        var agreementDetailString = getAgreementLine(lineId);
                        log.debug({title: "Agreement Line Object", details: agreementDetailString});
                        if(agreementDetailString){
                            form.addField({
                                id: 'custpage_agreement_line_detail',
                                type: serverWidget.FieldType.LONGTEXT,
                                label: 'Agreement Line Detail'
                            }).updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            }).defaultValue = JSON.stringify(agreementDetailString);
                        }
                        else{
                            isErrorPage = true;
                        }
                    }
                    else{
                        isErrorPage = true;
                    }
                    /**********************
                    * Fields To Store Data
                    **********************/
                   if(isErrorPage == false){
                    form.addField({
                        id: 'custpage_line_usage',
                        type: serverWidget.FieldType.LONGTEXT,
                        label: 'Line Usage'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = getLineUsage(lineId);
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
                        id: 'custpage_agreement_status_list',
                        type: serverWidget.FieldType.LONGTEXT,
                        label: 'Agreement Status List'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = getAgreementStatus();
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
                   else{
                    form.addField({
                        id: 'custpage_fld_html',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Error Control'
                    }).defaultValue = '<iframe id="agreement" scrolling="no" seamless="seamless" style="margin-top: -10px;min-height: 500px;display: block;  width: 100%; border: none;" src="' + fileURLs.errorPage + '"></iframe>';
                   }  
                }
                context.response.writePage(form);
            }
            catch(error){
                log.error({title: "Error| Suitelet GET Request", details: error});
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
                        ["name", "is", "AgreementLineControl.html"],
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
                if (fileName == "AgreementLineControl.html") {
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
                   search.createColumn({name: "internalid", sort: search.Sort.ASC, label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_a_subsidiary", label: "Subsidiary"})
                ]
             });
             var id, subsidiary;
             agreementSrch.run().each(function(result){
                id = result.getValue({ name: "internalid",  sort: search.Sort.ASC, label: "Internal ID" });
                subsidiary = result.getValue({name: "custrecord_ps_a_subsidiary", label: "Subsidiary"});
                optionString = optionString + "<option data-subsdiary='" + subsidiary + "'  value='" + id + "'>" + id + "</option>"
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
                   ["custitem_ps_agreement_item","noneof","@NONE@"], 
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "itemid", sort: search.Sort.ASC,label: "Name"}),
                   search.createColumn({name: "custitem_ps_agreement_item", label: "Agreement Item"}),
                   search.createColumn({name: "subsidiary", label: "Subsidiary"}),
                   search.createColumn({name: "type", label: "Type"}),
                   search.createColumn({name: "includechildren", label: "Include Children"})
                ]
             });
            var id, name, type, agreementType, subsidiary, includeChildren;
            itemSrch.run().each(function (result) {
                id = result.getValue({ name: "internalid", label: "Internal ID" });
                name = result.getValue({ name: "itemid", sort: search.Sort.ASC, label: "Name" });
                type = result.getValue({ name: "type", label: "Type" });
                subsidiary = result.getValue({name: "subsidiary", label: "Subsidiary"});
                agreementType = result.getValue({name: "custitem_ps_agreement_item", label: "Agreement Item"});
                includeChildren = result.getValue({name: "includechildren", label: "Include Children"});
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
        function getAgreementItemTypes(){
            var optionString = "<option value=''></option>";
            var agreementTypeSrch = search.create({
                type: "customrecord_ps_agreement_type",
                filters:
                [
                   ["isinactive","is","F"]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"})
                ]
             });
             var id, name;
             agreementTypeSrch.run().each(function(result){
                id = result.getValue({ name: "internalid", label: "Internal ID" });
                name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
                optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
                return true;
             });
             return optionString;
        }
        function getPriceLevels(){
            var optionString = "<option value=''></option>";
            var agreementTypeSrch = search.create({
                type: "customrecord_ps_agreement_pricing",
                filters:
                [
                   ["isinactive","is","F"]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"})
                ]
             });
             var id, name;
             agreementTypeSrch.run().each(function(result){
                id = result.getValue({ name: "internalid", label: "Internal ID" });
                name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
                optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
                return true;
             });
             return optionString;
        }
        function getPriceTypes(){
            var optionString = "<option value=''></option>";
            var agreementTypeSrch = search.create({
                type: "customlist_ps_agreement_pricing_type",
                filters:
                [
                   ["isinactive","is","F"]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                   search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"})
                ]
             });
             var id, name;
             agreementTypeSrch.run().each(function(result){
                id = result.getValue({ name: "internalid", label: "Internal ID" });
                name = result.getValue({ name: "name", sort: search.Sort.ASC, label: "Name" });
                optionString = optionString + "<option value='" + id + "'>" + name + "</option>"
                return true;
             });
             return optionString;
        }
        function getUsageGroup(){
            var optionString = "<option value=''></option>";
            var agreementTypeSrch = search.create({
                type: "customrecord_ps_agreement_group",
                filters:
                [
                   ["isinactive","is","F"]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"}),
                ]
             });
             var id;
             agreementTypeSrch.run().each(function(result){
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
        function getAgreementLine(lineId){
            var lineDetail = null;
            var agreementLineSrch = search.create({
                type: "customrecord_ps_agreement_details",
                filters:
                    [
                        ["isinactive","is","F"], 
                        "AND", 
                        ["internalid", "anyof", lineId]
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
                        search.createColumn({ name: "custrecord_ps_a_subsidiary", join: "CUSTRECORD_PS_AAD_AGREEMENT", label: "Subsidiary"}),
                        search.createColumn({ name: "custrecord_ps_aad_agreement", label: "Agreement"})
                    ]
            });
            agreementLineSrch.run().each(function (result) {
                lineDetail = {
                    id : result.getValue({ name: "internalid", label: "Id" }),
                    item : result.getText({ name: "custrecord_ps_aad_item", label: "Item" }),
                    itemId : result.getValue({ name: "custrecord_ps_aad_item", label: "Item" }),
                    quantity : result.getValue({ name: "custrecord_ps_aad_quantity", label: "Quantity" }),
                    amount : result.getValue({ name: "custrecord_ps_aad_amount", label: "Amount" }),
                    startDate : result.getValue({ name: "custrecord_ps_aad_start_date", label: "Start Date" }),
                    endDate : result.getValue({ name: "custrecord_ps_aad_end_date", label: "End Date" }),
                    nextBillingDate : result.getValue({ name: "custrecord_ps_aad_next_billing_date", label: "Next Billing Date" }),
                    renewalDate : result.getValue({ name: "custrecord_ps_aad_next_renewal_date", label: "Renewal Date" }),
                    lastBillingDate : result.getValue({ name: "custrecord_ps_aad_last_billing_date", label: "Last Billing Date" }),
                    status : result.getText({ name: "custrecord_ps_aad_status", label: "Status" }),
                    agreementLineType : result.getText({ name: "custrecord_ps_aad_agreement_type", label: "Agreement Type" }),
                    priceLevel : result.getText({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                    priceLevelId :  result.getValue({ name: "custrecord_ps_aad_price_level", label: "Price Level" }),
                    agreementPricingType : result.getText({ name: "custrecord_ps_aad_pricing_type", label: "Price Type" }),
                    createdFromTransactionId : result.getValue({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                    createdFromTransaction : result.getText({ name: "custrecord_ps_aad_created_from", label: "Created From" }),
                    transactionLineUniqueKey : result.getValue({ name: "custrecord_ps_aad_tran_line_key", label: "Transaction Line Key" }),
                    billingFrequency : result.getText({ name: "custrecord_ps_aad_billing_frequency", label: "Billing Frequency" }),
                    rate :result.getValue({ name: "custrecord_ps_aad_rate", label: "Rate" }),
                    requiredMinimum : result.getValue({ name: "custrecord_ps_aad_required_minimum", label: "Required Minimum" }),
                    usageGroup : result.getValue({ name: "custrecord_ps_aad_usage_group", label: "Usage Group" }),
                    subsidiary : result.getValue({ name: "custrecord_ps_a_subsidiary", join: "CUSTRECORD_PS_AAD_AGREEMENT", label: "Subsidiary"}),
                    agreementId : result.getValue({ name: "custrecord_ps_aad_agreement", label: "Agreement"})
                };
                return true;
            });
            return lineDetail;
        }
        function getLineUsage(lineId){
            var usageResult = [];
            var lineUsageDrch = search.create({
                type: "customrecord_ps_agreement_usage",
                filters:
                [
                   ["custrecord_ps_au_agreement_detail","anyof", lineId]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", sort: search.Sort.DESC, label: "Internal ID"}),
                   search.createColumn({name: "custrecord_ps_au_usage_date", label: "Usage Date"}),
                   search.createColumn({name: "custrecord_ps_au_item", label: "Item"}),
                   search.createColumn({name: "custrecord_ps_au_usage_qty", label: "Usage Quantity"}),
                   search.createColumn({name: "custrecord_ps_au_agreement_detail", label: "Agreement Detail"}),
                   search.createColumn({name: "custrecord_ps_au_demo", label: "Memo"}),
                   search.createColumn({name: "custrecord_ps_au_is_billed", label: "Is Billed"})
                ]
             });
             lineUsageDrch.run().each(function(result){
                usageResult.push({
                    id: result.getValue({name: "internalid", sort: search.Sort.DESC, label: "Internal ID"}),
                    usageDate: result.getValue({name: "custrecord_ps_au_usage_date", label: "Usage Date"}),
                    usageItem: result.getText({name: "custrecord_ps_au_item", label: "Item"}),
                    usageQty: result.getValue({name: "custrecord_ps_au_usage_qty", label: "Usage Quantity"}),
                    agreementLineId : result.getValue({name: "custrecord_ps_au_agreement_detail", label: "Agreement Detail"}),
                    memo: result.getValue({name: "custrecord_ps_au_demo", label: "Memo"}),
                    isBilled : result.getValue({name: "custrecord_ps_au_is_billed", label: "Is Billed"}),
                });
                return true;
             });
            return JSON.stringify(usageResult);
        }

        return {
            onRequest: onRequest
        }
    });