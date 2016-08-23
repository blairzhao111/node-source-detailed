// "http" module
// "http" module contains all related functionalities of http client/server.
// Similar to "Stream" module, "http" module itself doesn't provide many inplementations. 
// It's more like a general API interface that gathers and exposes multiple submodule.

// "http" module provides five subtypes, they are following:
//   1. http.Server, an instance of http.Server represents a http server.
//   2. http.ClientRequest, an instnce of http.ClientRequest represents an in-progress request from client to server. 
//   3. http.IncomingMessage, an instance of http.IncomingMessage represents incoming message to the dest. 
//   4. http.ServerResponse, an instance of http.ServerResponse represents the http response in the server side.
//	 5. http.Agent, an instance of http.Agent is used for pooling sockets used in HTTP client requests.

// "http" module contains functionalities for two roles: http Client and http Server
// For Client part:
// 	 1. A http request issued from client to server is an instance of http.ClientRequest, which is implemented as Writable stream.
//   2. Normally http client request is sent by calling http.request/http.get and passing along with necessary server and protocol information.
//   3. When response for previous client request is returned from server, a 'response' event is emitted and response listener is invoked.
//   4. When client's response listener is invoked, 'response' object is passed as argument to that handler function.
//   5. The 'response' object is an instance of http.IncomingMessage. 
// For Server part:
//   1. A http server is an instance of http.Server class, which is inherited from net.Server
//   2. Normally http server is created and returned by calling http.createServer() and passing along with a requestListener function for 'request' event.
//   3. Everytime when a new http request is coming in, a 'request' is emitted and that requestListener would be invoked to habdle the request.
//   4. When new request coming in, requestListener is invoked with two objects, 'request' object and 'response' object.
//   5. The 'request' object is an instance of http.incomingMessage.
//   6. The 'response' object is an instance of http.serverResponse.

'use strict';

const util = require('util');
const internalUtil = require('internal/util');
const EventEmitter = require('events');
const common = require('_http_common');

//Expose a list of http methods that are supported by the parser.
exports.METHODS = common.methods.slice().sort();

exports.OutgoingMessage = require('_http_outgoing').OutgoingMessage;


// ==============================================================================================================
// http.Agent

const agent = require('_http_agent');
const Agent = exports.Agent = agent.Agent;

//Global instance of Agent which is used as the default for all http client requests.
exports.globalAgent = agent.globalAgent;

// ==============================================================================================================
// http.ClientRequest

//Expose the ClientRequest class. An instance of ClientRequest is created internally and returned from http.request().
//A ClientRequest object represents an in-progress request whose header has already been queued. 
//The header is still mutable using the setHeader(name, value), getHeader(name), removeHeader(name) API. The actual header will be sent along with the first data chunk or when closing the connection.
//To get the response, add a listener for 'response' to the request object. 'response' will be emitted from the request object when the response headers have been received. 
//If no 'response' handler is added, then the response will be entirely discarded.
const client = require('_http_client');
const ClientRequest = exports.ClientRequest = client.ClientRequest;

// return an instance of the http.ClientRequest. Used to issue http request to specified server.
// options can contain:
// 1.protocol: Protocol to use. Default is 'http:'
// 2.host: A domain name or IP address of requested server. Default is 'localhost'
// 3.hostname: Alias to host, which is prfered because it supports url.parse()
// 4.family: IP address family to use when try to resolve hostname, valid value is 4 for IPV4 and 6 for IPV6. If not specified, both versions would be tried.
// 5.port: Port of requested server. Default is 80.
// 6.localAddress: Local interface to bind for network connection.
// 7.socketPath: Unix Domain Socket. (use either port or socketPath)
// 8.method: A string specifying the HTTP method. Default is 'GET'
// 9.path: Request path. Default is '/'. Should include query strings if they're needed. Like "/index.html?q=search".
// 10.header: An object contains http request headers.
// 11.auth: Basic authenrication.
// 12.agent: Controls Agent behavior. Could be undefined(then http.globalAgent would be used), Agent(explictly pass an agent) and false.
// 13.createConnection: A function that produces a socket/stream to use for the request when the agent option is not used. 
//
// The optional callback would be attached as one-time listener for 'response' event and gets invoked when response of issued request coming back.
exports.request = function(options, cb) {
	return new ClientRequest(options, cb);
};

// shortcut for issuing a HTTP GET request to specified server
// Almost identical to http.request(), the only difference is it uses 'GET' and calls req.end() automatically.
exports.get = function(options, cb) {
	var req = exports.request(options, cb);
	req.end();
	return req;
};

// ============================================================================================================
// http.Server Section:

const server = require('_http_server');

// exports the Server type as http.Server
const Server = exports.Server = server.Server;

exports._connectionListener = server._connectionListener;

//Exports a collection of all standard HTTP response status codes, along with short description of each.
exports.STATUS_CODES = server.STATUS_CODES;

// invoking this function returns a new instance of http.Server, which represents a http server.
// requestListener is a listener function listening on server 'request' event,, this event would emit when a new request coming in.
// requestListener gets invoked with two arguments, like function(request, response){}
// request object could be used to extract incoming http request's information
// response object could be used to send proper server response back to request issuer.
exports.createServer = function(requestListener) {
	return new Server(requestListener);
};

// ============================================================================================================
// http.ServerResponse Section:

// The instance of this type is created internally by HTTP servers, not by the users. 
// Instance is created and passed as the second parameter 'response' object to requestListener function that listens on 'request' event.
// The ServerResponse implements, but does not inherit from, the Writable Stream interface. 
exports.ServerResponse = server.ServerResponse;

// =============================================================================================================
// http.IncomingMessage Section:

exports.IncomingMessage = require('_http_incoming').IncomingMessage;