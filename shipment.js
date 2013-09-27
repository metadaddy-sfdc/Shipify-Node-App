var decode = require('salesforce-signed-request');
var errors = require('./errors.js');
var events = require('events');
var util = require('util');
var request = require('request');
var warehouseId15Chars;
var orderNumber;

function Shipment() {
	events.EventEmitter.call(this);
}

util.inherits(Shipment, events.EventEmitter);

Shipment.prototype.processSignedRequest = function processSignedRequest(signedRequest, APP_SECRET) {
	var sfContext = decode(signedRequest, APP_SECRET);
	return {
		oauthToken: sfContext.client.oauthToken,
		instanceUrl: sfContext.client.instanceUrl,
		warehouseId: sfContext.context.environment.parameters.id //sent as parameters via visualForce parameters
	}
};

Shipment.prototype.getInvoices = function getInvoices(authorization, instanceUrl, warehouseId) {
	var q = 'SELECT Invoice__c From Line_Item__C';

	if (warehouseId && warehouseId != 'undefined' && warehouseId != '' && (warehouseId.length == 15 || warehouseId.length == 18)) {
		warehouseId15Chars = warehouseId.substr(0, 15);
		q += " where Warehouse__C = '" + warehouseId + "' OR Warehouse__C = '" + warehouseId15Chars + "'";
	}
	var reqOptions = {
		url: instanceUrl + '/services/data/v28.0/query?q=' + q,
		headers: {
			'Authorization': this._formatAuthHeader(authorization)
		}
	}

	var self = this;
	request(reqOptions, function(err, response, body) {
		if (err) {
			return self.emit('error', err);
		}
		self._getInvoicesFromIds(authorization, instanceUrl, JSON.parse(body));
	});
};

Shipment.prototype._getInvoicesFromIds = function getInvoicesFromIds(authorization, instanceUrl, invoices) {
	var idsClause = this._getIdsWhereClause(invoices);
	var q = "SELECT Id, Name, Account__c, Account__r.Name, Invoice_Total__c, Status__c FROM Invoice__c Where Status__c !='Closed' AND " + idsClause;

	var authorization = this._formatAuthHeader(authorization);
	var reqOptions = {
		url: instanceUrl + '/services/data/v28.0/query?q=' + q,
		headers: {
			'Authorization': authorization
		}
	};
	var self = this;
	request(reqOptions, function(err, response, body) {
		if (err) {
			return self.emit('error', err);
		} else {
			return self.emit('invoices', JSON.parse(body));
		}
	});
};

//  {
//     authorization: req.headers.authorization,
//     instanceUrl: req.headers.instance_url,
//     invAccountId: req.body.ParentId,
//     invoiceName: req.body.Name,
//     invoiceId: req.params.invoiceId
//   }
Shipment.prototype.ship = function ship(so) {
	var body = {
		ParentId: so.invAccountId,
		Body: this._getShipmentChatterMsg(so)
	}

	var authorization = this._formatAuthHeader(so.authorization);

	var reqOptions = {
		url: so.instanceUrl + '/services/data/v28.0/sobjects/FeedItem/',
		method: 'POST',
		headers: {
			'Authorization': authorization,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	var self = this;

	request(reqOptions, function(err, response, body) {
		var statusCode = response.statusCode;
		if (!err && (statusCode == 200 || statusCode == 201)) {
			if(warehouseId15Chars != 'undefined'){
				var quickActionBody = {
					Warehouse__c: warehouseId15Chars,
					Invoice__c: so.invoiceId,
					Order_Number__c: orderNumber
				};

				var delivery = {
					url: so.instanceUrl + '/services/data/v29.0/sobjects/Warehouse__c/quickActions/Create_Delivery/',
					method: 'POST',
					headers: {
						'Authorization': authorization,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(quickActionBody)

				};

				request(delivery, function(err, response, body) {
					var statusCode = response.statusCode;
					if (err) {
						self.emit('error', err);
					}
				});
			}
			
			self._closeInvoice(so);
		} else {
			self.emit('error', err);
		}
	});
};

Shipment.prototype._closeInvoice = function _closeInvoice(so) {
	var authorization = this._formatAuthHeader(so.authorization);
	var body = {
		'Status__C': 'Closed'
	}
	var reqOptions = {
		url: so.instanceUrl + '/services/data/v28.0/sobjects/Invoice__c/' + so.invoiceId,
		method: 'PATCH',
		headers: {
			'Authorization': authorization,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	var self = this;
	request(reqOptions, function(err, response, body) {
		var statusCode = response.statusCode;
		if (!err && (statusCode == 200 || statusCode == 204)) {
			self.emit('shipped', {
				'result': 'OK'
			});
		} else {
			self.emit('error', err);
		}
	});
};

Shipment.prototype._getShipmentChatterMsg = function _getShipmentChatterMsg(so) {
	// This is a randomly generated number, but in reality would be a real number grabbed from this back end system 
	orderNumber = Math.floor(Math.random() * 90000) + 10000;
	return "Invoice: " + so.invoiceName + " has been shipped! Your order number is #" + orderNumber + " " + so.instanceUrl + "/" + so.invoiceId
}

Shipment.prototype._getIdsWhereClause = function _getIdsWhereClause(invoices) {
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

Shipment.prototype._formatAuthHeader = function _formatAuthHeader(header) {
	var h = header.toLowerCase(header);
	return h.indexOf('oauth ') == 0 ? header : 'OAuth ' + header;
}

exports = module.exports = new Shipment();