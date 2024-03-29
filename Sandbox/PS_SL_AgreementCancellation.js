/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
 define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record', 'N/format', 'N/redirect', 'N/runtime','./moment.min.js'], 
 function(serverWidget, log, search, record, format, redirect, runtime, moment) {
    function onRequest(context){
        var currentUserObj = runtime.getCurrentUser();
        var dateFormat = currentUserObj.getPreference ({
          name: 'dateformat'
        });
        if(context.request.method === 'GET'){
          var agreementId = context.request.parameters.agreementId;
          log.debug({ title : "Agreement Id", details : agreementId });
          var form = serverWidget.createForm({
              title: 'Agreement Cancellation',
              hideNavBar: true
          });
          form.clientScriptModulePath = './PS_CS_AgreementCancellation_Helper.js';
          var cancellationReasonOptions = getCancellationReasons();
          /*************************
           * Server side fields
           **********************/
           form.addField({
                id: 'custpage_pref_date_format',
                type: serverWidget.FieldType.TEXT,
                label: 'Date Format'
           }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
           }).defaultValue = dateFormat;
          if(agreementId){
            var agreementFld = form.addField({
                id: 'custpage_agreement',
                type: serverWidget.FieldType.TEXT,
                label: 'Agreement'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = agreementId;
            var affectiveDateFld = form.addField({
                id: 'custpage_affective_date',
                type: serverWidget.FieldType.DATE,
                label: 'Effective Date'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            var ConcludingEventFld = form.addField({
                id: 'custpage_concluding_event',
                type: serverWidget.FieldType.TEXT,
                label: 'Concluding Event'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }).defaultValue = "Cancelled";
            var ConcludingEventReasonFld = form.addField({
                id: 'custpage_concluding_event_reason',
                type: serverWidget.FieldType.SELECT,
                label: 'Concluding Event Reason'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            if(ConcludingEventReasonFld && cancellationReasonOptions && cancellationReasonOptions.length > 0){
                ConcludingEventReasonFld.addSelectOption({
                    value : '',
                    text : ''
                });
                for(var r = 0; r < cancellationReasonOptions.length; r++){
                    ConcludingEventReasonFld.addSelectOption({
                        value : cancellationReasonOptions[r].id,
                        text : cancellationReasonOptions[r].name
                    });
                }
            }
            /*************************
             **********************/
            var jsonDataFld = form.addField({
                id: 'custpage_json_data',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'JSON Data'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            form.addSubmitButton({ label: 'Submit' });
            log.debug({ title : "Cancellation options", details : cancellationReasonOptions });
            var html = '<!DOCTYPE html>\
              <html lang="en">\
                <head>\
                    <title>Agreement Cancellation</title>\
                    <meta charset="utf-8">\
                    <meta name="viewport" content="width=device-width, initial-scale=1">\
                    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">\
                    <style>\
                        .modal .modal-dialog {\
                            max-width: 400px;\
                        }\
                        .modal .modal-header, .modal .modal-body, .modal .modal-footer {\
                            padding: 20px 30px;\
                        }\
                        .modal .modal-content {\
                            border-radius: 3px;\
                        }\
                        .modal .modal-footer {\
                            background: #ecf0f1;\
                            border-radius: 0 0 3px 3px;\
                        }\
                        .modal .modal-title {\
                            display: inline-block;\
                        }\
                        .modal .form-control {\
                            border-radius: 2px;\
                            box-shadow: none;\
                            border-color: #dddddd;\
                        }\
                        .modal textarea.form-control {\
                            resize: vertical;\
                        }\
                        .modal .btn {\
                            border-radius: 2px;\
                            min-width: 100px;\
                        }\
                        .modal form label {\
                            font-weight: normal;\
                        }\
                        .date_field {\
                            position: relative;\
                            color: white;\
                        }\
                        .date_field:before {\
                            position: absolute;\
                            content: attr(data-date);\
                            display: inline-block;\
                            color: black;\
                        }\
                        .date_field::-webkit-datetime-edit, .date_field::-webkit-inner-spin-button, .date_field::-webkit-clear-button {\
                            display: none;\
                        }\
                        .date_field::-webkit-calendar-picker-indicator {\
                            position: absolute;\
                            top: 3px;\
                            right: 0;\
                            color: black;\
                            opacity: 1;\
                        }\
                    </style>\
                </head>\
                <body>';
            if(agreementId){
              html = html + '<div id="errorMappingModal" class="modal fade">\
                  <div class="modal-dialog">\
                    <div class="modal-content">\
                        <form>\
                            <div class="modal-header" style="background: #d9534f;color: #fff;">\
                                <h4 class="modal-title">Error</h4>\
                                <button type="button" class="close" data-dismiss="modal" aria-hidden="true" \
                                        style="color: white;opacity: 0.6;">&times;</button>\
                            </div>\
                            <div class="modal-body">\
                                <p></p>\
                            </div>\
                            <div class="modal-footer">\
                                <input type="button" class="btn btn-default" data-dismiss="modal" value="Close">\
                            </div>\
                        </form>\
                    </div>\
                </div>\
              </div>\
              <div class="container" style="width: 100%;font-size:14px;font-family: "Helvetica Neue",Helvetica,Arial,sans-serif";line-height: 1.42857143;">\
                  <h2 style="width: 500px; margin:0 auto;margin-bottom: 20px;font-weight: bold;text-decoration: underline;font-size: 27px;">Agreement Cancellation</h2>\
                  <div style=" width: 85%;">\
                      <div class="form-row">\
                          <div class="form-group col-md-6">\
                              <div class="col-md-8 " style="padding: 0px"> \
                                <label for="agreementId">Agreement</label>\
                                <input type="text" class="form-control" id="agreementId" value="'+agreementId+'" disabled="disabled">\
                              </div>\
                          </div>\
                          <div class="form-group col-md-6">\
                              <div class="col-md-8 " style="padding: 0px"> \
                                  <label for="concluding_event">Concluding Event</label>\
                                  <input type="text" class="form-control" id="concluding_event" value="Cancelled" disabled="disbaled">\
                              </div>\
                          </div>\
                      </div>\
                      <div class="form-row">\
                          <div class="form-group col-md-6">\
                              <div class="col-md-8 " style="padding: 0px"> \
                                <label for="effective_date">Effective Date</label>\
                                <input type="date"  class="date_field form-control" data-date="" id="effective_date"  data-date-format="'+dateFormat+'">\
                              </div>\
                          </div>\
                          <div class="form-group col-md-6">\
                              <div class="col-md-8 " style="padding: 0px"> \
                                  <label for="concluding_event_reason">Concluding Event Reason</label>\
                                  <select id="concluding_event_reason" class="form-control">\
                                      '+prepareReasonListHtml(cancellationReasonOptions, null)+'\
                                  </select>\
                              </div>\
                          </div>\
                      </div>\
                      <div class="form-row">\
                        <div class="form-group col-md-6">\
                          <div class="col-md-8 " style="padding: 0px"> \
                            <button type="submit" class="btn btn-primary" id="submit_cancellation_SL">Submit</button>\
                          </div>\
                        </div>\
                      </div>\
                  </div><table class="table" style=" margin: 10px; width:99%" id="custpage_list_agreement_detail_splits">\
                      <thead style="background: #435d7d;color: #fff;">\
                          <tr>\
                              <th scope="col">\
                                  <div class="form-check">\
                                      <input class="form-check-input" type="checkbox" value="" id="parent_checkbox">\
                                  </div>\
                              </th>\
                              <th scope="col" style="font-weight: bold;">Item</th>\
                              <th scope="col"  style="font-weight: bold;">Effective Date</th>\
                              <th scope="col"  style="font-weight: bold;">Concluding Reason</th>\
                          </tr>\
                      </thead>\
                      <tbody>'+loadTableData(agreementId, cancellationReasonOptions, dateFormat)+'</tbody>\
                  </table>\
                </div>';
            }
            html = html + '</body>\
                        </html>';
            var htmlFld = form.addField({
              id: 'custpage_inline_html',
              type: serverWidget.FieldType.INLINEHTML,
              label: 'HTML Field'
            }).defaultValue = "<script>document.open();\
            document.write('"+html+"');\
            document.close();\
            jQuery('body').css('background-color', '#f7f7f7');\
            jQuery('.uir-record-type').hide();\
            jQuery('#tr_submitter').hide();</script>\
            <script src='https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'></script>\
            <script src='https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js'></script>";
          }
          context.response.writePage(form);
        }
        else{
            try{
                var form = serverWidget.createForm({
                    title: 'Agreement Cancellation',
                    hideNavBar: true
                });
                var agreementId = context.request.parameters.custpage_agreement;
                log.debug({title : "POST : Agreement Id", details : agreementId});
                var jsonData = context.request.parameters.custpage_json_data;
                log.debug({title : "JSON agreement detail data", details : jsonData});
                var concludingReason = context.request.parameters.custpage_concluding_event_reason;
                var effecctiveDate = context.request.parameters.custpage_affective_date? 
                                    moment(context.request.parameters.custpage_affective_date).format(dateFormat) : 
                                    context.request.parameters.custpage_affective_date;
                if(jsonData){
                    jsonData = JSON.parse(jsonData);
                    var totalLines = jsonData.length;
                    var generatedLines = 0;
                    if(jsonData && jsonData.length > 0){
                        var currentEffectiveDate = effecctiveDate;
                        var currentConcludingReason = concludingReason;
                        for(var j = 0; j < jsonData.length; j++){
                            if(jsonData[j].effecctiveDate){
                                currentEffectiveDate = jsonData[j].effecctiveDate;
                            }
                            if(jsonData[j].reason){
                                currentConcludingReason = jsonData[j].reason;
                            }
                            var newId = addConclucionRecord(agreementId, jsonData[j].conclusionId, jsonData[j].id, currentConcludingReason, currentEffectiveDate); 
                            log.debug({title : "New Conclusion rec Id", details : newId});
                            if(newId){
                                generatedLines = generatedLines + 1;
                            }
                        }
                        if(totalLines == generatedLines){
                            var htmlFld = form.addField({
                                id: 'custpage_html_fld',
                                type: serverWidget.FieldType.INLINEHTML,
                                label: 'Response'
                            }).defaultValue = "<h4>Agreement conclusion record(s) generated successfully.</h4>";
                            redirect.toRecord({
                                type: "customrecord_ps_agreement",
                                id: agreementId,
                            });
                        }
                        else{
                            var htmlFld = form.addField({
                                id: 'custpage_html_fld',
                                type: serverWidget.FieldType.INLINEHTML,
                                label: 'Response'
                            }).defaultValue = "<h4>Something went wrong, Agreement conclusion record(s) partially generated successfully.</h4>";
                        }
                    }
                }
            }
            catch(error){
                log.error({title : "Error in post call", details : error});
                var htmlFld = form.addField({
                    id: 'custpage_html_fld',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Response'
                }).defaultValue = "<h4>Something went wrong, Unexpected server error.</h4>";
            }
        }
        context.response.writePage(form);
    }
    /**********************
     * Helper Functions****
    **********************/
    function getCancellationReasons(){
        var reasonList = [];
        var cancellationReasonsSch = search.create({
            type: "customrecord_ps_agreement_event_reason",
            filters:
            [
               ["isinactive","is","F"], 
               "AND", 
               ["custrecord_ps_agreement_concluding_event","anyof","2"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"})
            ]
         });
         cancellationReasonsSch.run().each(function(result){
            reasonList.push({
                id : result.getValue({name: "internalid", label: "Internal ID"}),
                name : result.getValue({name: "name", sort: search.Sort.ASC, label: "Name"})
            });
            return true;
         });
        return reasonList;
    }
    function prepareReasonListHtml(reasonList, selectedValue){
        var html = '<option value ="" ></option>';
        if(reasonList && reasonList.length > 0){
            for(var r = 0; r <  reasonList.length; r++){
                if(selectedValue == reasonList[r].id){
                    html = html + '<option selected="selected" value ="'+reasonList[r].id+'" >'+reasonList[r].name+'</option>';
                }
                else{
                    html = html + '<option value ="'+reasonList[r].id+'" >'+reasonList[r].name+'</option>';
                }
            }
        }
        return html;
    }
    function loadTableData(agreementId, reasons, dateFormat) {
      var rows = '';
      try{
          if(agreementId){
              var conclusionList = getExistingConclusionRecords(agreementId);
              log.debug({ title : "Conclusion List", details : conclusionList});
              var agreementDetailList = getAgreementDetails(agreementId);
              log.debug({ title : "Agreement Details", details : agreementDetailList});
              if(agreementDetailList && agreementDetailList.length > 0){
                  for(var i = 0; i < agreementDetailList.length; i++){
                      var rows = rows +'<tr data-id="' + agreementDetailList[i].id + '">';
                      var filterData;
                      if(conclusionList && conclusionList.length > 0){
                          filterData = conclusionList.filter(function(x){return x.agreementDetailId == agreementDetailList[i].id});
                      } 
                      if(filterData && filterData.length > 0){
                          var selectedDate = "";
                          if(filterData[0].effectiveDate){
                            selectedDate = filterData[0].effectiveDate;
                          }
                          rows = rows + '<th scope="row"><div class="form-check">\
                                <input class="form-check-input selected_agreement_detail" type="checkbox"  data-conclusionid="' + filterData[0].conclusionId + '" \
                                checked="checked" disabled="disabled" id="' + agreementDetailList[i].id + '"> </th>\
                          <input type="checkbox" data-conclusionid="' + filterData[0].conclusionId + '"  class="checkbox selected_agreement_detail" id="' + agreementDetailList[i].id + '" \
                                  checked="checked" disabled="disabled" ></td> \
                              <td>' + agreementDetailList[i].item + '</td> \
                              <td><input class="date_field form-control line_effective_date" data-date="'+selectedDate+'" data-date-format="'+dateFormat+'"\
                                                style="max-width:210px;" type="date" value="'+selectedDate+'"/></td> \
                              <td><select class="form-control line_cancel_reason" style="max-width: 300px;">'+prepareReasonListHtml(reasons, filterData[0].reason)+'</select></td>\
                          </tr>';
                        
                      }
                      else{
                        rows = rows + '<th scope="row"><div class="form-check">\
                        <input class="form-check-input selected_agreement_detail" type="checkbox"  data-conclusionid="" id="' + agreementDetailList[i].id + '" ></th> \
                              <td>' + agreementDetailList[i].item + '</td> \
                              <td><input class="date_field form-control line_effective_date" data-date=""  data-date-format="'+dateFormat+'"\
                              style="max-width:210px;" type="date"/></td> \
                              <td><select class="form-control line_cancel_reason" style="max-width: 300px;">'+prepareReasonListHtml(reasons, null)+'</select></td>\
                          </tr>';
                      }
                  }
              }
          }
      }
      catch(error){
      }
      return rows;
    }
    function getExistingConclusionRecords(agreementId){
        var conclusionList = [];
        var conclusionSrch = search.create({
            type: "customrecord_ps_agreement_conculsion",
            filters:
            [
               ["custrecord_ps_ac_agreement","anyof", agreementId]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_as_agreement_detail", label: "Agreement Detail"}),
               search.createColumn({name: "custrecord_ps_concluding_event_reason", label: "Concluding Event Reason"}),
               search.createColumn({name: "custrecord_ps_ac_effective_date", label: "Effective Date"})
            ]
        });
        conclusionSrch.run().each(function(result){
            conclusionList.push({
                conclusionId : result.getValue({name: "internalid", label: "Internal ID"}),
                agreementDetailId : result.getValue({name: "custrecord_ps_as_agreement_detail", label: "Agreement Detail"}),
                effectiveDate : result.getValue({name: "custrecord_ps_ac_effective_date", label: "Effective Date"}),
                reason : result.getValue({name: "custrecord_ps_concluding_event_reason", label: "Concluding Event Reason"}), 
            });
            return true;
        });
        return conclusionList;
    }
    function getAgreementDetails(agreementId){
        var data = [];
        var agreementDetailSch = search.create({
            type: "customrecord_ps_agreement_details",
            filters:
            [
               ["custrecord_ps_aad_agreement","anyof", agreementId], 
               "AND", 
               ["custrecord_ps_aad_status","noneof","3"]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "custrecord_ps_aad_item", label: "Item"})
            ]
         });
         agreementDetailSch.run().each(function(result){
            data.push({
                id : result.getValue({name: "internalid", label: "Internal ID"}),
                item : result.getText({name: "custrecord_ps_aad_item", label: "Item"}),
            });
            return true;
         });
        return data; 
    }
    function addConclucionRecord(agreementId , conclusionId, detailId, reason, date){
        log.debug({title : "agreement id | detail id | reason | date", details : agreementId+" | "+detailId+" | "+reason+" | "+date});
        var conclusionRec = null;
        if(conclusionId){
            conclusionRec = record.load({
                type: "customrecord_ps_agreement_conculsion",
                id : conclusionId,
                isDynamic: true,
            });
        }
        else{
            conclusionRec = record.create({
                type: "customrecord_ps_agreement_conculsion",
                isDynamic: true,
            });
        }
        
        conclusionRec.setValue({
            fieldId : "custrecord_ps_ac_concluding_event",
            value : "2"
        });
        conclusionRec.setValue({
            fieldId : "custrecord_ps_ac_agreement",
            value : agreementId
        });
        conclusionRec.setValue({
            fieldId : "custrecord_ps_as_agreement_detail",
            value : detailId
        });
        conclusionRec.setValue({
            fieldId : "custrecord_ps_concluding_event_reason",
            value : reason
        });
        conclusionRec.setValue({
            fieldId : "custrecord_ps_ac_effective_date",
            value : format.parse({value: date, type: format.Type.DATE})
        });
        var newId = conclusionRec.save({
            enableSourcing: true, 
            ignoreMandatoryFields: true 
        });
        return newId;
    }

    return {
        onRequest: onRequest
    }
});