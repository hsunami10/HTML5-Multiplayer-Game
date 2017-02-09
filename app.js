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


// List of sockets and players
var SOCKET_LIST = {};
var PLAYER_LIST = {};

// Returns object with properties
var Player = function(id) {
	var self = {
		x: 250,
		y: 250,
		id: id,
		number: "" + Math.floor(10 * Math.random()),
		pressingRight: false,
		pressingLeft: false,
		pressingUp: false,
		pressingDown: false,
		maxSpd: 10
	};
	// Add method
	self.updatePosition = function() {
		if(self.pressingDown)
			self.y += self.maxSpd;
		if(self.pressingLeft)
			self.x -= self.maxSpd;
		if(self.pressingRight)
			self.x += self.maxSpd;
		if(self.pressingUp)
			self.y -= self.maxSpd;
	};
	return self;
};


// When a user connects, a socket is established
io.on('connection', function(socket) {
	console.log('User (socket) connected');

	// Assign a unique id to socket AND player
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	// Create player with id, add to list
	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;

	// Handle key press event
	socket.on('keyPress', function(data) {
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});


	// Disconnect event
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});
});

// Called every 40 milliseconds
setInterval(function() {
	// Hold all of the users' data
	var pack = [];

	// For every player connected, change position
	for(var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];
		player.updatePosition();

		// Add data (that everyone can see) to pack
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}

	// Send pack to each user
	for(var a in SOCKET_LIST) {
		var sockets = SOCKET_LIST[a];
		sockets.emit('newPosition', pack);
	}

}, 1000/25);