exports = module.exports = {
	HTTP_GET_NOT_SUPPORTED: 'First make HTTP POST to "/" w/ Salesforce signed-request. HTTP GET to  "/" is not allowed.' + '\n Make sure to that signed-request has: access_token, instance_url and warehouseId (sent as "parameters" from VF page to canvas)',
	SIGNED_REQUEST_PARSING_ERROR:  "Either signed Request was not correct or, one of the following was missing from signed request: oauthToken or instanceUrl or warehouseId",
	MUST_PASS_AUTH_INSTANCE_URL: "Must pass 'instance_url', 'warehouse_id' and 'Authorization'(= session_id) in the header.",
	MISSING_REQUIRED_SHIPPING_PARAMETERS: 'One of the following shipping related parameters is missing: authorization, instanceUrl, invAccountId, invoiceName, or invoiceId'
}