(function ($, $$) {

    "use strict";

    var action = "share", shipmentPost;

    var module = {
        instance : function(sr) { 
            var payload;

            var handlers = {
                onSetupPanel : function(payload) {
                	console.log("EH Module setupPanel..", payload);
                },
                onShowPanel : function(payload) {
                    console.log("EH Module showPanel", payload);
                },
                onClearPanelState : function(payload) {
                    console.log("EH Module clearPanelState");
                    // Reset panel to show list of open invoices
                    getInvoices();
                    
                    // Re enable the default selection
                    action = "share";
                },
                onSuccess : function() {
                    console.log("EH Module onSuccess");
                },
                onFailure : function () {
                    console.log("EH Module onFailure");
                },
                onGetPayload : function () {
                    var p = {};
                    console.log("EH Module getPayload");
                    
                    p.feedItemType = "CanvasPost";
                    p.auxText = "Status for Order #"+so.orderNumber;
                    p.namespace =  "";
                    p.developerName =  "ShipmentMonday"; /* This needs to be the API Name of your Connected App */
                    p.thumbnailUrl = "https://cdn1.iconfinder.com/data/icons/VISTA/project_managment/png/48/deliverables.png";
                    p.parameters =  "{\"order\":\"" + so.orderNumber + "\"}";
                    p.title =  "Shipment Status";
                    p.description = "This is a shipment status for your delivery. Click the link to open the Canvas App.";
                    
                    // Note: we can extend the payload here to include more then just value.
                    $$.client.publish(sr.client, {name : 'publisher.setPayload', payload : p});
                }
            };

            var that = {
                //draw : draw,
                //refresh : refresh,
                //approve : approve,

                // Subscriptions to callbacks from publisher...
                subscriptions : [
                    {name : 'publisher.setupPanel', onData : handlers.onSetupPanel},
                    {name : 'publisher.showPanel', onData : handlers.onShowPanel},
                    {name : 'publisher.clearPanelState',  onData : handlers.onClearPanelState},
                    {name : 'publisher.failure', onData : handlers.onFailure},
                    {name : 'publisher.success', onData : handlers.onSuccess},
                    {name : 'publisher.getPayload', onData : handlers.onGetPayload}
                ]
            };
            return that;
        }
    };

    // Replace with module pattern
    window.shipmentPost = module;

}(jQuery, Sfdc.canvas));