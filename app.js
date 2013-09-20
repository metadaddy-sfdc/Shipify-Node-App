var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var decode = require('./decode.js');
var request = require('request');
var os = require("os");
console.log(os.hostname());
var APP_SECRET = process.env.APP_SECRET;


// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('/etc/apache2/ssl/host.key'),
  cert: fs.readFileSync('/etc/apache2/ssl/server.crt')
};



// Create a service (the app object is just a callback).
var app = express();

app.configure(function() {
  app.use(express.favicon());
  app.set('view engine', 'ejs');
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/', function(req, res) {
  res.render("index", {
    result: 'do post to see result here'
  });
});



app.post('/', function(req, res) {
  console.log('http post');

  //console.log(req.body.signed_request);
  var sfJSON;
  try {
    sfJSON = decode(req.body.signed_request, APP_SECRET);
  } catch (e) {
    res.render("error", {
      error: JSON.stringify(e)
    });
    return;
  }
  res.render("index", sfJSON);

});


app.get('/invoices', getInvoices);
app.post('/ship/:invoiceId/?', postInvoiceInfoToAccountFeed);



function getInvoices(req, res) {
  var q = "SELECT Id, Name, Account__c, Account__r.Name, Invoice_Total__c FROM Invoice__c";
  //console.log(q);

  if (!req.headers.authorization || !req.headers.instance_url) {
    res.json(400, {
      'Error': "Must pass 'instance_url' and 'Authorization' (= session_id) in the header."
    });
    return;
  }

  var authorization = getAuthHeader(req.headers.authorization);
  var options = {
    url: req.headers.instance_url + '/services/data/v28.0/query?q=' + q,
    headers: {
      'Authorization': authorization
    }
  };
  console.log(options)
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

function postInvoiceInfoToAccountFeed(req, res) {
  //var feedItem = nforce.createSObject('FeedItem');
  console.log(req.body);

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

  console.log(options);

  request(options, function(err, response, body) {
    if (!err && response.statusCode <= 201) {
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

config.log("process.env.RUNNING_ON_HEROKU = " + process.env.RUNNING_ON_HEROKU);
//if not running on Heroku..
if (!process.env.RUNNING_ON_HEROKU) {
  // Create an HTTP service.
  http.createServer(app).listen(80);
  // Create an HTTPS service identical to the HTTP service.
  https.createServer(options, app).listen(443);
} else {
  http.createServer(app).listen(3000);
}