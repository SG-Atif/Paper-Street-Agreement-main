/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/error', 'N/log', 'N/search', './moment.min.js', 'N/https', 'N/url'],
    function (error, log, search, moment, https, url) {
        var pageLoaderURl = '';
        function pageInit(context) {
            pageLoaderURl = getLoaderGif();
            var spinnerHTML = '<div id="cust_pageLoader" class="loader" \
                                        style="position: fixed; \
                                            display: none; width: 100%;height: 100%; \
                                            background-repeat: no-repeat; \
                                            background-attachment: fixed; \
                                            background-position: center; opacity: 0.7;\
                                            background-color: black; z-index:99999999999999;"> \
                                    </div>';
            jQuery("body").prepend(spinnerHTML);
        }
        /**********************
         * Helper Functions****
        **********************/
        function getLoaderGif() {
            var url = '';
            var fileSearchObj = search.create({
                type: "file",
                filters:
                    [
                        ["name", "is", "Loader.gif"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" }),
                        search.createColumn({ name: "url", label: "URL" })
                    ]
            });
            var searchResultCount = fileSearchObj.runPaged().count;
            log.debug("fileSearchObj result count", searchResultCount);
            fileSearchObj.run().each(function (result) {
                url = result.getValue({ name: "url", label: "URL" });
                return true;
            });
            return url;
        }
        function getParameters(key) {
            var paramVal = null;
            var urlString = window.location.href;
            var paramString = urlString.split('?')[1];
            var params_arr = paramString.split('&');
            for (var k = 0; k < params_arr.length; k++) {
                var pair = params_arr[k].split('=');
                if (pair[0] == key) {
                    paramVal = pair[1];
                }
            }
            return paramVal;
        }
        function getGroupItemMembers(id) {
            var memberList = [];
            var itemGroupSrch = search.create({
                type: "itemgroup",
                filters:
                    [
                        ["type", "anyof", "Group"],
                        "AND",
                        ["internalid", "anyof", id]
                    ],
                columns:
                    [
                        search.createColumn({ name: "memberitem", label: "Member Item" }),
                        search.createColumn({ name: "memberquantity", label: "Member Quantity" }),
                        search.createColumn({ name: "salesdescriptiontranslated", join: "memberItem", label: "Sales Description (Translated)" }),
                        search.createColumn({ name: "baseprice", join: "memberItem", label: "Base Price" })
                    ]
            });
            itemGroupSrch.run().each(function (result) {
                memberList.push({
                    id: result.getValue({ name: "memberitem", label: "Member Item" }),
                    name: result.getText({ name: "memberitem", label: "Member Item" }),
                    qty: result.getValue({ name: "memberquantity", label: "Member Quantity" }),
                    description: result.getValue({ name: "salesdescriptiontranslated", join: "memberItem", label: "Sales Description (Translated)" }),
                    rate: result.getValue({ name: "baseprice", join: "memberItem", label: "Base Price" }),

                });
                return true;
            });
            return memberList;
        }
        function sendAPICall(param, url, method) {
            var response = null;
            if (url == "GET") {
                response = https.get({ url: url });
            }
            else if (method == "POST") {
                response = https.post({
                    url: url,
                    body: param,
                });
            }
            if (response) {
                var myresponse_code = response.code;
                var myresponse_headers = response.headers;
                return response.body;
            }
            return response;
        }
        function getRecordUrl(type, id) {
            var recordURL = url.resolveRecord({
                recordType: type,
                recordId: id,
                isEditMode: false
            });
            return recordURL;
        }

        return {
            pageInit: pageInit,
            getGroupItemMembers: getGroupItemMembers,
            sendAPICall: sendAPICall,
            getRecordUrl: getRecordUrl
        };
    });