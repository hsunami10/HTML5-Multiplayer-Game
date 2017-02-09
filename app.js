var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

server.listen(2000);
console.log('Server started');


//////////////////////////////////////////////////////////////////////


// List of sockets
var SOCKET_LIST = {};


// When someone connects
io.on('connection', function(socket) {
	console.log('User connected');

	// Assign a unique id to each player when connected
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 0;
	// Random number between 0 and 10 to distinguish players
	socket.number = "" + Math.floor(10 * Math.random());
	SOCKET_LIST[socket.id] = socket;

	// Disconnect event
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
	});
});

// Called every 40 milliseconds
setInterval(function() {
	// Hold all of the user's x and y position data
	var pack = [];

	// For every player connected, loop through them, change position
	for(var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.x++;
		socket.y++;

		// Add data to pack
		pack.push({
			x: socket.x,
			y: socket.y,
			number: socket.number
		});
	}

	// Send to all users
	for(var a in SOCKET_LIST) {
		var sockets = SOCKET_LIST[a];
		sockets.emit('newPosition', pack);
	}

}, 1000/25);