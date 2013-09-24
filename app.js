var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var decode = require('./decode.js');
var request = require('request');
var os = require("os");
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

app.get('/', function(req, res) {
  res.render("error", {
    error: 'First make HTTP POST to "/" w/ Salesforce signed-request. HTTP GET to  "/" is not allowed.' + '\n Make sure to that signed-request has: access_token, instance_url and warehouseId (sent as "parameters" from VF page to canvas)'
  });
});



app.post('/', function(req, res) {
  console.log('http post');


  var sfJSON;
  try {
    sfJSON = decode(req.body.signed_request, APP_SECRET);
  } catch (e) {
    res.render("error", {
      error: JSON.stringify(e)
    });
    return;
  }

  res.cookie('oauthToken', sfJSON.client.oauthToken, {
    expires: new Date(Date.now() + 900000),
    httpOnly: true,
    secure: true
  });

  var jsonBackToClient;
  try {
    jsonBackToClient = {
      oauthToken: sfJSON.client.oauthToken,
      instanceUrl: sfJSON.client.instanceUrl,
      warehouseId: sfJSON.context.environment.parameters.id
    }
  } catch (e) {
    res.render("error", {
      "error": 'One of the following was missing from signed-request: oauthToken or instanceUrl or warehouseId'
    })
  }


  res.render("index", jsonBackToClient);
});


app.get('/invoices', getInvoiceIdsFromLineItems);
app.post('/ship/:invoiceId/?', postInvoiceInfoToAccountFeed);



function getInvoiceIdsFromLineItems(req, res) {
  var q = 'SELECT Invoice__c From Line_Item__C';
  if (!req.headers.authorization || !req.headers.instance_url) {
    res.json(400, {
      'Error': "Must pass 'instance_url', 'warehouse_id' and 'Authorization'(= session_id) in the header."
    });
    return;
  }

  var warehouseId = req.headers.warehouse_id;
  if (warehouseId && warehouseId != 'undefined' && warehouseId != '' && (warehouseId.length == 15 || warehouseId.length == 18)) {
    var warehouseId15Chars = warehouseId.substr(0, 15);
    q += " where Warehouse__C = '" + warehouseId + "' OR Warehouse__C = '" + warehouseId15Chars + "'";
  }


  var authorization = getAuthHeader(req.headers.authorization);
  var options = {
    url: req.headers.instance_url + '/services/data/v28.0/query?q=' + q,
    headers: {
      'Authorization': authorization
    }
  };

  request(options, function(err, response, body) {
    if (!err) {
      getInvoicesFromIds(req, res, JSON.parse(body));
      //res.json(JSON.parse(body));
    } else {
      res.json(400, {
        'result': 'error',
        'error': err
      });
    }
  });
}

function getInvoicesFromIds(req, res, invoices) {
  var idsClause = getIdsWhereClause(invoices);
  var q = "SELECT Id, Name, Account__c, Account__r.Name, Invoice_Total__c, Status__c FROM Invoice__c Where Status__c !='Closed' AND " + idsClause;

  var authorization = getAuthHeader(req.headers.authorization);
  var options = {
    url: req.headers.instance_url + '/services/data/v28.0/query?q=' + q,
    headers: {
      'Authorization': authorization
    }
  };

  request(options, function(err, response, body) {
    if (!err) {
      res.json(JSON.parse(body));
    } else {
      res.json(400, {
        'result': 'error',
        'error': err
      });
    }
  });
}

function getIdsWhereClause(invoices) {
  var items = invoices.records;
  var str = '';
  var ids = [];
  for (var i = 0; i < items.length; i++) {
    var id = items[i]['Invoice__c'];
    if (id && str.indexOf(id) == -1) {
      var formattedId = "Id = '" + id + "' ";
      str += formattedId + " ";
      ids.push(formattedId);
    }
  }
  return "(" + ids.join(' OR ') + ")";
}

function postInvoiceInfoToAccountFeed(req, res) {
  if (!req.headers.instance_url || !req.body.ParentId || !req.headers.authorization) {
    res.json(400, {
      'Error': "Must pass 'instance_url' and 'Authorization' (= session_id) in the header. Also Must pass 'ParentId' in the POST body. "
    })
    return;
  }

  /* This is a randomly generated number, but in reality would be a real number grabbed from this back end system */
  var orderNumber = Math.floor(Math.random() * 90000) + 10000;

  var body = {
    ParentId: req.body.ParentId,
    Body: "Invoice: " + req.body.Name + " has been shipped! Your order number is #" + orderNumber + " " + req.headers.instance_url + "/" + req.params.invoiceId
  }

  var authorization = getAuthHeader(req.headers.authorization);
  var options = {
    url: req.headers.instance_url + '/services/data/v28.0/sobjects/FeedItem/',
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };


  request(options, function(err, response, body) {
    var statusCode = response.statusCode;
    if (!err && (statusCode == 200 || statusCode == 201)) {
      // res.json({
      //   'result': 'OK'
      // });
      closeInvoice(req, res, req.params.invoiceId);
    } else {
      res.json(400, {
        'result': 'error',
        'error': JSON.parse(body)
      });
    }
  });
}

function closeInvoice(req, res, invoiceId) {
  var authorization = getAuthHeader(req.headers.authorization);
  var body = {
    'Status__C': 'Closed'
  }
  var options = {
    url: req.headers.instance_url + '/services/data/v28.0/sobjects/Invoice__C/' + invoiceId,
    method: 'PATCH',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  request(options, function(err, response, body) {
    var statusCode = response.statusCode;
    if (!err && (statusCode == 200 || statusCode == 204)) {
      res.json({
        'result': 'OK'
      });
    } else {
      res.json(400, {
        'result': 'error',
        'error': JSON.parse(body)
      });
    }
  });

}


function getAuthHeader(header) {
  var h = header.toLowerCase(header);
  return h.indexOf('oauth ') == 0 ? header : 'OAuth ' + header;
}

console.log("process.env.RUNNING_ON_HEROKU = " + (process.env.RUNNING_ON_HEROKU ? 'true' : 'false'));

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