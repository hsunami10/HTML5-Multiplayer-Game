var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var mongojs = require('mongojs');

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

server.listen(2000);
console.log('Server started');


//////////////////////////////////////////////////////////////////////


// List of sockets
var SOCKET_LIST = {};

// Object that holds general properties - Entity "constructor"
var Entity = function() {
	var self = {
		x: 250,
		y: 250,
		spdX: 0,
		spdY: 0,
		id: ''
	};
	self.update = function() {
		self.updatePosition();
	};
	self.updatePosition = function() {
		self.x += self.spdX;
		self.y += self.spdY;
	};
	self.getDistance = function(pt) {
		return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y-pt.y, 2));
	};
	return self;
};

// Add more specific player properties - Player "constructor"
var Player = function(id) {
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 8;
	self.attackCooldown = 0;

	// Copy of original update function, override
	var super_update = self.update;
	self.update = function() {
		// Update spdX and spdY, then update position
		self.updateSpd();
		super_update();

		self.attackCooldown++;

		// Create bullet at position of player
		if(self.pressingAttack) {
			self.shootBullet(self.mouseAngle);

			// Spread
			/*
			for(var i = -3; i < 3; i++)
				self.shootBullet(i * 10 + self.mouseAngle);
			*/
		}
	};
	self.shootBullet = function(angle) {
		if(self.attackCooldown % 20 === 0) {
			var bullet = Bullet(self.id, angle);
			bullet.x = self.x;
			bullet.y = self.y;
		}
	};

	self.updateSpd = function() {
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;

		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
	};

	// Automatically add to list when player is created
	Player.list[id] = self;
	return self;
};
// Make the player list static and local to all players
Player.list = {};

// Static function
// Separate player from socket
Player.onConnect = function(socket) {
	// Create player with id, add to list
	var player = Player(socket.id);

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
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
};
Player.onDisconnect = function(socket) {
	delete Player.list[socket.id];
};
Player.update = function() {
	// Hold all of the users' data
	var pack = [];

	// For every player connected, change position of player object
	for(var i in Player.list) {
		var player = Player.list[i];
		player.update();

		// Add data (that everyone can see) to pack
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}
	return pack;
};

// Add more specific bullet properties - Bullet "constructor"
var Bullet = function(parent, angle) {
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180 * Math.PI) * 10;
	self.spdY = Math.sin(angle/180 * Math.PI) * 10;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	// Override
	var super_update = self.update;
	self.update = function() {
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for(var i in Player.list) {
			var p = Player.list[i];

			// If distance from bullet and any player is less than 32
			// and it is not the player who fired it, then remove
			if(self.getDistance(p) < 32 && self.parent != p.id) {
				self.toRemove = true;
			}
		}
	};
	Bullet.list[self.id] = self;
	return self;
};
Bullet.list = {};

Bullet.update = function() {
	
	var pack = [];
	
	for(var i in Bullet.list) {
		var bullet = Bullet.list[i];
		bullet.update();

		if(bullet.toRemove)
			delete Bullet.list[i];
		else {
			// Add data (that everyone can see) to pack
			pack.push({
				x: bullet.x,
				y: bullet.y
			});
		}
	}
	return pack;
};

// Sign in handling
// Contains all players and their username: password pairs
var USERS = {};
var isValidPassword  = function(data, cb) {
	setTimeout(function() {
		cb(USERS[data.username] === data.password);
	}, 10);
};
var isUsernameTaken  = function(data, cb) {
	setTimeout(function() {
		cb(USERS[data.username]);
	}, 10);
};
var addUser = function(data, cb) {
	setTimeout(function() {
		USERS[data.username] = data.password;
		cb();
	}, 10);
};

// When a user connects, a socket is established
io.on('connection', function(socket) {
	console.log('User (socket) connected');

	// Assign a unique id to socket AND player
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	// Sign in
	socket.on('signIn', function(data) {
		isValidPassword(data, function(res) {
			if(res) {
				Player.onConnect(socket);
				socket.emit('signInResponse', {success: true});
			}
			else
				socket.emit('signInResponse', {success: false});
		});
	});

	// Sign up
	socket.on('signUp', function(data) {
		isUsernameTaken(data, function(res) {
			if(res) {
				socket.emit('signUpResponse', {success: false});
			}
			else {
				addUser(data, function(){
					socket.emit('signUpResponse', {success: true});
				});
			}
		});
	});

	// Chat events
	socket.on('sendMsgToServer', function(msg) {
		var playerName = ("" + socket.id).slice(2, 7);
		// Loop through every socket and send to every socket
		for(var i in SOCKET_LIST) {
			SOCKET_LIST[i].emit('addToChat', playerName + '[global]: ' + msg);
		}
	});
	socket.on('sendPrivateMsg', function(data) {
		for(var i in SOCKET_LIST) {
			var playerName = ("" + SOCKET_LIST[i].id).slice(2, 7);
			if(playerName == data.user) {
				SOCKET_LIST[i].emit('addToChat', ("" + socket.id).slice(2,7) + '[private]: ' + data.msg);
				socket.emit('addToChat', ("" + socket.id).slice(2,7) + '[private]: ' + data.msg);
			}
		}
	});

	// Disconnect event
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
		console.log('User (socket) disconnected');
	});
});

// Called every 20 milliseconds
setInterval(function() {
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	};

	// Send pack to each socket (user)
	for(var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPosition', pack);
	}

}, 1000/50);