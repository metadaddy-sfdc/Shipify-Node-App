<p align="center">
![image](https://raw.github.com/rajaraodv/shipment/master/images/shipment-readme.jpg)

## About
This is a proof of concept shipment fulfillment app that shows how to tightly integrate a 3rd party app like this one, into Salesforce using <b>Salesforce Canvas</b> technology.

## How it Works
On its own it performs 2 tasks:

1. Displays list of `open Invoice` items. 
2. And allows a Salesforce user to 'ship' an invoice. i.e. Marks the invoice as `closed` and also posts a message to that invoice's Account chatter feed indicating that the Invoice has been shipped.

## The problem
While the app is fine, the user still has to:

1. Open this app in a different browser tab even though he is in Salesforce in another tab.
2. Login via OAuth 
3. Filter invoices by Warehouse (i.e. no context as this app doesnt know where in Salesforce the user is currently in)
4. And finally, select the invoice ship it.


## The Solution
Salesforce Canvas technology allows us to pass Salesforce user information and access_token in an encrypted string called: `signed_request`. Further, Canvas also allows embedding third party apps as 'tabs', 'links', 'buttons' etc at various location inside Salesforce.

To take advantage of Canvas, we need to do the following:


1. Create a new `HTTP POST` endpoint like `https://www.myshipmentapp.com/signed-request`on our 3rd party app. 
2. Ask (or login as) Salesforce Administrator and register this app as a Canvas app `[Admin Name] > Setup > Create > apps > Connected Apps > New`.  
3. Provide the end point from #1 as the `Canvas app URL`. The configuration might look like <a href='https://raw.github.com/rajaraodv/shipment/master/images/salesforce-admin-canvas.png' target='_blank'>this</a>.


#### Deep Contextual Embedding 
To go one step further, let's contextually embed this app as a button (say 'Ship It' button) inside custom object (say: Warehouse) that look like <a href='https://raw.github.com/rajaraodv/shipment/master/images/ship-it-button.png' target='_blank'>this</a>.



1. Open `[Admin Name] > Setup > Develop > Pages` and create a Visualforce page to wrap around the canvas app. This allows us to pass current page's context like `Warehouse__c.Id` to the 3rd party app.

```
<apex:page standardController="Warehouse__c" sidebar="false" showheader="false">
    <apex:canvasApp developerName="shipment" width="100%" parameters="{'id':'{!Warehouse__c.Id}'}"    />
</apex:page>
```
<img src="https://raw.github.com/rajaraodv/shipment/master/images/visualforcepage-canvas-wrapper.png" height="400" width="700px" /> 

2.Open `[Admin Name] > Setup > Create > Objects` and open up the custom object. In our case, `warehouse` object. 
2.1 Then under `"Buttons, Links, and Actions" > New`, create an action button called `Ship It` that opens up the Visualforce page we had created earlier in Step 1.
<img src="https://raw.github.com/rajaraodv/shipment/master/images/ship-it-button-code.png" height="400" width="700px" /> 

#### Code snippet that processes signed-request and sends the result back to user/browser.

```javascript

//Processes signed-request and displays index.ejs
app.post('/signedrequest', processSignedRequest); 

function processSignedRequest(req, res) {
  console.log('in http post');
  try {
    var json = shipment.processSignedRequest(req.body.signed_request, APP_SECRET);
    res.render("index", json);
  } catch (e) {
    res.render("error", {
      "error": errors.SIGNED_REQUEST_PARSING_ERROR
    });
  }
}

```

#### Picture of Canvas App configuration in Salesforce

<img src="https://raw.github.com/rajaraodv/shipment/master/images/salesforce-admin-canvas.png" height="400" width="700px" />

(click to enlarge)

#### Picture of highly contextual 'ship button'

<img src="https://raw.github.com/rajaraodv/shipment/master/images/ship-it-button.png" height="400" width="700px" />

(click to enlarge)


#### Picture of 'Shipment' link in Chatter tab.
<img src="https://raw.github.com/rajaraodv/shipment/master/images/chatter-tab.png" height="400" width="700px" />

(click to enlarge)


