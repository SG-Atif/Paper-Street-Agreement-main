/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
 define(['N/error', 'N/log', 'N/search','./moment.min.js', 'N/format'],
 function(error, log, search, moment, format) {
    var pageLoaderURl = '';
    function pageInit(context) {
        pageLoaderURl = getLoaderGif();
        var spinnerHTML = '<div id="cust_pageLoader" class="loader" \
                                        style="position: fixed; \
                                            display: none; width: 100%;height: 100%; \
                                            background-repeat: no-repeat; \
                                            background-attachment: fixed; \
                                            background-position: center; margin-top: -40px;\
                                            opacity: 0.7;background-color: black; z-index:99999999999999;"> \
                                    </div>';
        jQuery("body").prepend(spinnerHTML);
        var dateFormat = context.currentRecord.getValue("custpage_pref_date_format");
        jQuery('.date_field').each(function(){
            jQuery(this).attr('data-date-format', dateFormat);
        });
        jQuery(".date_field").on("change", function() {
            if(this.value){
                this.setAttribute(
                    "data-date",
                    moment(this.value, "YYYY-MM-DD").format(this.getAttribute("data-date-format") )
                )
            }
        }).trigger("change");
        jQuery("#custpage_list_agreement_detail_splits").on("change", "input, select", function(){
            var jsonData = [];
            jQuery("#custpage_list_agreement_detail_splits").find("tr:gt(0)").each(function(){
                if(jQuery(this).find(".selected_agreement_detail").is(":checked")){
                    var rowId = jQuery(this).data("id");
                    if(rowId){
                        jsonData.push({
                            conclusionId : jQuery(this).find(".selected_agreement_detail").data("conclusionid"),
                            id : rowId,
                            effecctiveDate : (jQuery(this).find(".line_effective_date").attr("data-date") ? 
                                                moment(new Date(jQuery(this).find(".line_effective_date").attr("data-date"))).format(dateFormat)
                                                : ""),
                            reason : jQuery(this).find(".line_cancel_reason").val()
                        });
                    }
                }
            });
            context.currentRecord.setValue({ fieldId : "custpage_json_data", value : JSON.stringify(jsonData)});
        });
        jQuery("#effective_date").on("change", function(){
            if(jQuery(this).val()){
                context.currentRecord.setValue({ fieldId : "custpage_affective_date", value : moment(jQuery(this).attr("data-date")).format(dateFormat)});
            }
            else{
                context.currentRecord.setValue({ fieldId : "custpage_affective_date", value : ""});
            }
        });
        jQuery("#concluding_event_reason").on("change", function(){
            context.currentRecord.setValue({ fieldId : "custpage_concluding_event_reason", value : $(this).val()});
        });
        jQuery("#parent_checkbox").on("click", function(){
            var table = jQuery(this).closest('table');
            $('input:checkbox', table).not(":disabled").prop('checked',this.checked);
        });
    }
    function saveRecord(context){
        var requiredFieldValidation = false;
        var headerEffectiveDate =   context.currentRecord.getValue({ fieldId : "custpage_affective_date"});
        console.log(headerEffectiveDate);
        var headerReason =  context.currentRecord.getValue({ fieldId : "custpage_concluding_event_reason"});
        console.log(headerReason);
        if(headerEffectiveDate && headerReason){
            requiredFieldValidation = true;
        }
        if(requiredFieldValidation == false){
            var totalSelectedLines = 0;
            var linesWithValues = 0;
            jQuery("#custpage_list_agreement_detail_splits").find("tr:gt(0)").each(function(){
                if(jQuery(this).find(".selected_agreement_detail").is(":checked")){
                    totalSelectedLines = totalSelectedLines + 1;
                    if(jQuery(this).find(".line_effective_date").attr("data-date") && jQuery(this).find(".line_cancel_reason").val()){
                        linesWithValues = linesWithValues + 1;
                    }
                }
            });
            if(totalSelectedLines < 1){
                jQuery("#errorMappingModal .modal-body p").text("Please select agreement detail line(s).");
				jQuery("#errorMappingModal").modal();
                return false;
            }
            else if(totalSelectedLines != linesWithValues){
                jQuery("#errorMappingModal .modal-body p").text("Please add effective date and concluding event reason.");
				jQuery("#errorMappingModal").modal();
                return false;
            }
        }
        return true;
    }
    /**********************
     * Helper Functions****
    **********************/
    function togglePageLoader(isShow) {
        var pageloader = document.getElementById("cust_pageLoader");
        if (isShow) {
            pageloader.style.backgroundImage = "url("+pageLoaderURl+")";
            pageloader.style.display = "block";
        } else {
            pageloader.style.display = "none";
        }
    }
    function getLoaderGif(){
        var url = '';
        var fileSearchObj = search.create({
            type: "file",
            filters:
            [
                ["name","is","Loader.gif"]
            ],
            columns:
            [
                search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"}),
                search.createColumn({name: "url", label: "URL"})
            ]
            });
            var searchResultCount = fileSearchObj.runPaged().count;
            log.debug("fileSearchObj result count",searchResultCount);
            fileSearchObj.run().each(function(result){
                url = result.getValue({name: "url", label: "URL"});
            return true;
        });
        return url;
    }
    function getParameters(key){
        var paramVal = null;
        var urlString = window.location.href;
        var paramString = urlString.split('?')[1];
        var params_arr = paramString.split('&');
        for(var k = 0; k < params_arr.length; k++){
            var pair = params_arr[k].split('=');
            if(pair[0] == key){
                paramVal = pair[1];
            }
        }
        return paramVal;
    }

    return {
        pageInit: pageInit,
        saveRecord : saveRecord
    };
 });