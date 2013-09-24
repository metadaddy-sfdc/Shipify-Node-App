var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');

var request = require('request');
var os = require("os");
var shipment = require('./shipment.js');
var errors = require('./errors.js');
var APP_SECRET = process.env.APP_SECRET;



// Create a service (the app object is just a callback).
var app = express();

app.configure(function() {
  app.use(express.favicon());
  app.set('view engine', 'ejs');
  app.use(express.logger('dev'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));
});

//End points..
app.get('/', processIndexGET); //HTTP GET to / (not allowed)
app.post('/signedrequest', processSignedRequest); //Processes signed-request and displays index.ejs
app.get('/invoices', getInvoices); //returns list of invoices based on warehouse context.
app.post('/ship/:invoiceId/?', shipInvoice); //Posts to Account Chatter feed and also updates Invoices' status to 'Closed'



function processSignedRequest(req, res) {
  console.log('in http post');
  console.log('req.body.signed_request = ' + req.body.signed_request);
  try {
    var json = shipment.processSignedRequest(req.body.signed_request, APP_SECRET);
    res.render("index", json);
  } catch (e) {
    res.render("error", {
      "error": errors.SIGNED_REQUEST_PARSING_ERROR
    });
  }
}

function getInvoices(req, res) {
  if (!req.headers.authorization || !req.headers.instance_url) {
    res.json(400, {
      'Error': errors.MUST_PASS_AUTH_INSTANCE_URL
    });
    return;
  }

  shipment.on('invoices', function(invoices) {
    res.json(invoices);
  });

  shipment.on('error', function(err) {
    res.json(400, err);
  });

  shipment.getInvoices(req.headers.authorization, req.headers.instance_url, req.headers.warehouse_id);
}


function shipInvoice(req, res) {
  var so = _getShipOptions(req);
  if (!so.authorization || !so.instanceUrl || !so.invAccountId || !so.invoiceName || !so.invoiceId) {
    return res.json(400, {
      'Error': errors.MISSING_REQUIRED_SHIPPING_PARAMETERS
    })
  }

  shipment.on('shipped', function(shipmentData) {
    res.json(shipmentData);
  });

  shipment.on('error', function(err) {
    res.json(400, err);
  });

  shipment.ship(so);
}

function _getShipOptions(req) {
  return {
    authorization: req.headers.authorization,
    instanceUrl: req.headers.instance_url,
    invAccountId: req.body.ParentId,
    invoiceName: req.body.Name,
    invoiceId: req.params.invoiceId
  }
}

//if not running on Heroku..
if (!process.env.RUNNING_ON_HEROKU) {
  // Create an HTTP service.
  http.createServer(app).listen(80);
  // Create an HTTPS service identical to the HTTP service.
  var options = {
    key: fs.readFileSync('/etc/apache2/ssl/host.key'),
    cert: fs.readFileSync('/etc/apache2/ssl/server.crt')
  };
  https.createServer(options, app).listen(443);
} else {
  http.createServer(app).listen(process.env.PORT);
}
console.log("process.env.RUNNING_ON_HEROKU = " + (process.env.RUNNING_ON_HEROKU ? 'true' : 'false'));
