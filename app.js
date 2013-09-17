/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  user = require('./routes/user'),
  http = require('http'),
  path = require('path'),
  nforce = require('nforce'),
  config = require('./config.json');

var app = express();

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

app.get('/invoices', getInvoices);
app.post('/ship/:invoiceId/?', postInvoiceInfoToAccountFeed);


var org = nforce.createConnection({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  redirectUri: config.redirectUri,
  apiVersion: config.apiVersion
});

var oauth;
org.authenticate({
  username: config.username,
  password: config.password
}, function(err, resp) {
  if (!err) {
    oauth = resp;
  } else {
    console.log('Error While authenticating the admin! \n' + err);
  }
});

function getInvoices(req, res) {
  var q = "SELECT Id, Name, Account__c, Invoice_Total__c FROM Invoice__c";
  org.query(q, oauth, function(err, resp) {
    if (!err) {
      res.json(resp);
    } else {
      res.json(400, {
        'result': 'error',
        'error': err
      });
    }
  });
}

function postInvoiceInfoToAccountFeed(req, res) {
  var feedItem = nforce.createSObject('FeedItem');
  console.log(req.body);
  feedItem.ParentId = req.body.ParentId;

  feedItem.Body = "Invoice: " + req.body.Name + " has been shipped! " + oauth.instance_url + "/" + req.params.invoiceId;

  org.insert(feedItem, oauth, function(err, resp) {
    if (!err) {
      res.json({
        'result': 'ok'
      });
    } else {
      res.json(400, {
        'result': 'error',
        'error': err
      });
    }
  });
}


http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});