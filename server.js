const express = require('express');
const path = require('path');
const http = require('http');
const PORT = process.env.PORT || 3000;
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, "public")));
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const maxLobbies = 10;
let availableLobby = 0;
let availableLobbyPlace = 0;
const connectionArray= [
    [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null],
   [null, null]
];

io.on("connection", socket => {
   let playerId = -1;
   let lobbyId = -1;

   if(availableLobbyPlace >= 2) {
      availableLobbyPlace = 0;
      availableLobby++;
   }

   while(availableLobby < maxLobbies && connectionArray[availableLobby][availableLobbyPlace] !== null){
      if(availableLobbyPlace >= 2) {
         availableLobbyPlace = 0;
         availableLobby++;
      }
      availableLobbyPlace++;
   }

   playerId = availableLobbyPlace;
   lobbyId = availableLobby;
   availableLobbyPlace++;

   socket.emit("playerId", {id: playerId, lobby: lobbyId});

   console.log(`Player ${playerId} in lobby ${lobbyId} has connected`);
   if(playerId === -1)
      return;

   connectionArray[lobbyId][playerId] = false;
   socket.broadcast.emit("playerConnection", {id: playerId, lobby: lobbyId});

   socket.on("disconnect", () => {
      console.log(`Player ${playerId} in lobby ${lobbyId} has disconnected`);
      connectionArray[lobbyId][playerId] = null;
      if(lobbyId < availableLobby) {
         availableLobby = lobbyId;
         availableLobbyPlace = playerId;
      }
      else if(lobbyId === availableLobby && playerId < availableLobbyPlace){
         availableLobbyPlace = playerId;
      }
      socket.broadcast.emit("playerConnection", {id: playerId, lobby: lobbyId});
   });

   socket.on("playerReady", () => {
      socket.broadcast.emit("enemyReady", {id: playerId, lobby: lobbyId});
      console.log(`Player ${playerId} in lobby ${lobbyId} is ready`);
      connectionArray[lobbyId][playerId] = true;
   });

   socket.on("checkOtherPlayers", () => {
      const playersArray = [];
      for(let i in connectionArray[lobbyId])
         connectionArray[lobbyId][i] === null ? playersArray.push({connected: false, ready: false}) : playersArray.push({connected: true, ready: connectionArray[lobbyId][i]});
      socket.emit("checkOtherPlayers", {playersArray: playersArray, lobby: lobbyId});
   });

   socket.on('shot', shotId => {
      console.log(`Shot fired from ${playerId} in lobby ${lobbyId} on ${shotId}`)
      socket.broadcast.emit('shot', {id: shotId, lobby: lobbyId});
   })

   socket.on('shotReply', classList => {
      socket.broadcast.emit('shotReply', {classList: classList, lobby: lobbyId});
   })
});



