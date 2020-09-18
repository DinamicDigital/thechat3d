// load modules
const path = require("path");
const http = require("http");
const express = require("express");
const socket = require("socket.io");
const THREE = require("three.js");
const c3ds = require("./c3ds"); //"chat 3d server" module

// globals
const app = express();
const server = http.Server(app);
const io = socket(server);

// main
let environment = c3ds.createEnvironment("testEnvironment");

// socket
io.on("connection", socket => {
  console.log("New socket connected"); //acknowledge existence of socket
	
  socket.on("clientReady", () => {
  	// Send the client an entity to bind to
		let clientEntity = initClientEntity(socket);
		socket.emit("clientEntityIDResponse", clientEntity.id);
		
		// Send the new entities to other clients
		let sockets = io.sockets;
		for(let i = 0; i < sockets; i++){
			let s = sockets[i];
			
			environment.sendEntities(socket);
		}
		
  });
  
  //Bind events (have to be called in function to be able to add socket as a parameter, TODO fix this stupid shortcut)
  socket.on("serverEntityCacheRequest", (id) => {
  	environment.serverEntityCacheRequest(socket, id); //make sure to bind all functions to environment so this calls aren't fucked up
  });
  
  socket.on("serverEntityDynamicRequest", (id) => {
  	environment.serverEntityDynamicRequest(socket, id);
	});
	
	socket.on("disconnect", (reason) => {
		console.log("socket disconnect");
		
		if(reason == 'io server disconnect' || reason == 'ping timeout'){
			socket.connect(); //if the client was kicked by the server, it attempts to relog the client and keeps the entity (this COULD be a risk because people could theoretically time themselves out repeatedly and then reconnect on a different client, until all entity ids are reserved.  this shouldn't be a problem rn tho)
		} else {
			environment.pullServerEntity(environment.getEntityBySocket.bind(environment)(socket)); //if the client intentionally disconnected, pull entity
		}
	});
});

// server
initServer();

// event listeners
function disconnect(reason){
	if(reason == 'io server disconnect' || reason == 'ping timeout'){
		socket.connect(); //if the client was kicked by the server, it attempts to relog the client and keeps the entity (this COULD be a risk because people could theoretically time themselves out repeatedly and then reconnect on a different client, until all entity ids are reserved.  this shouldn't be a problem rn tho)
	} else {
		environment.pullServerEntity(environment.getEntityBySocket(socket)); //if the client intentionally disconnected, pull entity
	}
}

// utils (that I couldn't bother putting into another file)
function initServer(){
  app.set('port', 8080);
  app.use("/static/", express.static(__dirname + "/static"));
  
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  
  server.listen(8080, () => {
    console.log("server started");
  });
}

//generates a random hex color
function randomColor(mode){
	return Math.floor(Math.random() * 16777216);
}

//generates a random xyz coordinate from -(a/2) to (a/2)
function randomCoords(mx, my, mz){
	return {
		x: Math.floor(Math.random() * (mx+1)) - mx/2,
		y: Math.floor(Math.random() * (my+1)) - my/2,
		z: Math.floor(Math.random() * (mz+1)) - mz/2,
	};
}

//inits a client entity
function initClientEntity(socket){
	let clientEntity = c3ds.createServerEntity(randomCoords(16, 0, 16), randomCoords(0, Math.PI*2, 0), environment.generateID(), randomColor(), null, socket); //create a new entity for the client
	
	environment.pushServerEntity(clientEntity);
	
	return clientEntity;
}
