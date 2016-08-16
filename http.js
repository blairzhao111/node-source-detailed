//"http" module

'use strict';

const util = require('util');
const internalUtil = require('internal/util');
const EventEmitter = require('events');

exports.IncomingMessage = require('_http_incoming').IncomingMessage;

const common = require('_http_common');

//Expose a list of the HTTP methods that are supported by the parser.
exports.METHODS = common.methods.slice().sort();

exports.OutgoingMessage = require('_http_outgoing').OutgoingMessage;

//Expose a collection of all the standard HTTP response status codes, and the short description of each.
exports.STATUS_CODES = server.STATUS_CODES;

const agent = require('_http_agent');
const Agent = exports.Agent = agent.Agent;

//Global instance of Agent which is used as the default for all http client requests.
exports.globalAgent = agent.globalAgent;

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

//This class inherits from net.Server and represents a HTTP server.
const server = require('_http_server');
//This object is created internally by a HTTP server, not by the user. It is passed as the second parameter to the 'request' event.
//The response implements, but does not inherit from, the Writable Stream interface. 
exports.ServerResponse = server.ServerResponse;

exports._connectionListener = server._connectionListener;

//expose the Server class as http.Server
const Server = exports.Server = server.Server;

//return a new instance of http.Server, representing a http server.
//requestListener is a function like function(request, response){}
//requestListener is added to the 'request' event, this event would emit when a new request coming in.
exports.createServer = function(requestListener) {
	return new Server(requestListener);
};