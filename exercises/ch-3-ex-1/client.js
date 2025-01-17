var express = require("express");
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var querystring = require('querystring');
var cons = require('consolidate');
var randomstring = require("randomstring");
var __ = require('underscore');
__.string = require('underscore.string');

var app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
var authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information


/*
 * Add the client information in here
 */
var client = {
	"client_id": "oauth-client-1",
	"client_secret": "oauth-client-secret-1",
	"redirect_uris": ["http://localhost:9000/callback"]
};

var protectedResource = 'http://localhost:9002/resource';

var state = randomstring.generate();

var access_token = null;
var scope = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req, res){
  var authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    state: state
  })
  res.redirect(authorizeUrl)
});

app.get('/callback', function(req, res){
  if (req.query.state !== state) {
    res.render('error', { error: 'invalid state string' })
    return
  }
  var code = req.query.code
  var form_data = qs.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: client.redirect_uris[0],
  })
  var headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'authorization': 'Basic ' + encodeClientCredentials(client.client_id, client.client_secret),
  }
  var tokRes = request('POST', authServer.tokenEndpoint, {
    body: form_data,
    headers: headers,
  })
  var body = JSON.parse(tokRes.getBody())
  access_token = body.access_token
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/fetch_resource', function(req, res) {
  if (access_token === null) {
    res.redirect('/authorize')
    return
  }
  var headers = {
    'authorization': 'Bearer ' + access_token,
  }
  var resource = request('POST', protectedResource, {
    headers: headers,
  })

  if (resource.statusCode >= 200 && resource.statusCode < 300) {
    var body = JSON.parse(resource.getBody())

    res.render('data', { resource: body })
    return
  } else {
    res.redirect('/authorize')
    return
  }
});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}

	return url.format(newUrl);
};

var encodeClientCredentials = function(clientId, clientSecret) {
	return new Buffer(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

var server = app.listen(9000, '0.0.0.0', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});

