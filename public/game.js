const rotateButton = document.querySelector("#RotateButton");
const readyButton = document.querySelector("#ReadyButton");
const dock = document.querySelector("#Dock");
const playerBoard = document.querySelector("#PlayerBoard");
const computerBoard = document.querySelector("#ComputerBoard");
const turnLabel = document.querySelector("#TurnLabel");
const infoLabel = document.querySelector("#InfoLabel");
const modalWindow = document.querySelector("#ModalWindowContainer");
const modalHeader = document.querySelector("#ModalHeader");
const modalOverlay = document.querySelector("#Overlay");

const boardSize = 10;
const gameMode = localStorage.getItem("gameMode");
let enemyReady = false;
let ready = false;
console.log(gameMode);

let playerId = 0;
let lobbyId = 0;

class Ship {
    constructor(name, size) {
        this.name = name;
        this.size = size;
    }
}

class Hit {
    constructor(shipName, x, y) {
        this.shipName = shipName;
        this.x = x;
        this.y = y;
    }
}

const oneDeck = new Ship("OneDeck", 1);
const twoDeck = new Ship("TwoDeck", 2);
const threeDeck = new Ship("ThreeDeck", 3);
const fourDeck = new Ship("FourDeck", 4);

const shipTypes = [oneDeck, oneDeck, oneDeck, oneDeck, twoDeck, twoDeck, twoDeck, threeDeck, threeDeck, fourDeck];

let gameOver = false;
let turn = "player";
let draggedShip;
let playerHitArray = [];
let computerHitArray = [];

let playerHitCount = 0;
let computerHitCount = 0;
let playerPreviousShotId = -1;

for(let i = 0; i < boardSize * boardSize; ++i){
    const playerBoardCell = document.createElement("div");
    playerBoardCell.classList.add("BoardCell");
    playerBoardCell.id = i;
    playerBoard.append(playerBoardCell);
    const computerBoardCell = document.createElement("div");
    computerBoardCell.classList.add("BoardCell");
    computerBoardCell.id = i;
    computerBoard.append(computerBoardCell);
}

let allPlayerBoardCells = Array.from(playerBoard.children);
let allComputerBoardCells = Array.from(computerBoard.children);
let socket;
rotateButton.addEventListener("click", rotateShips);

if(gameMode === "singleplayer"){
    readyButton.addEventListener("click", startSingleplayerGame);
    document.querySelector("#PlayerBox").classList.add("Hidden");
}

let computerAnalysedShip = {
    x: -1,
    y: -1,
    isHorizontal: undefined,
    directionSeekMode: false,
    directionSeekCounter: 0,
    shootingSide: undefined,
    focused: false,
    focusedCounter: 2,
    previousShot: undefined
};
let computerLogicShootingArray = [boardSize];

for (let i = 0; i < boardSize; i++) {
    computerLogicShootingArray[i] = [];
    for (let j = 0; j < boardSize; j++) {
        computerLogicShootingArray[i][j] = 0;
    }
}


let dockedShipsAngle = 0;
let dockedShips = Array.from(dock.children);
let computerLogicBoardArray = [boardSize];
let playerLogicBoardArray = [boardSize];

for (let i = 0; i < boardSize; i++) {
    computerLogicBoardArray[i] = [];
    playerLogicBoardArray[i] = [];
    for (let j = 0; j < boardSize; j++) {
        computerLogicBoardArray[i][j] = 0;
        playerLogicBoardArray[i][j] = 0;
    }
}

if(gameMode === "multiplayer") {
    socket = io();

    socket.on("playerId", data => {
        if(data.id === -1){
            infoLabel.textContent = "Info: All lobbies are full";
        }
        else{
            playerId = parseInt(data.id);
            lobbyId = parseInt(data.lobby);
            if(playerId === 1)
                turn = "enemy";
            console.log(`Player id: ${playerId}`);
            console.log(`Lobby id: ${lobbyId}`)
            readyButton.addEventListener("click", () => {
                multiplayerGameLoop(socket);
            });

            allComputerBoardCells.forEach(cell => {
                cell.addEventListener('click', () => {
                    if(turn === "player" && ready && enemyReady) {
                        if(!cell.classList.contains("Destroyed") && !cell.classList.contains("Empty")) {
                            let shotFired = cell.id;
                            console.log(`Fired on cell ${cell.id}`);
                            socket.emit('shot', shotFired);
                            playerPreviousShotId = cell.id;
                            turn = "enemy";
                            turnLabel.textContent = "Turn: Enemy";
                        }
                    }
                })
            });

            socket.on('shot', data => {
                if(data.lobby === lobbyId) {
                    console.log(`Enemy shot ${data.id}`);
                    multiplayerEnemyTurn(data.id);
                    //console.log(allPlayerBoardCells[id].classList);
                    setTimeout(() => {
                        turn = "player";
                        turnLabel.textContent = "Turn: Player";
                        multiplayerGameLoop(socket);
                    }, 1500);
                    socket.emit('shotReply', allPlayerBoardCells[data.id].classList);
                }
            });

            socket.on('shotReply', data => {
                if(data.lobby === lobbyId) {
                    multiplayerPlayerTurn(data.classList);
                    multiplayerGameLoop(socket);
                }
            });

            socket.emit("checkOtherPlayers");

            socket.on("enemyReady", data => {
                if(data.lobby === lobbyId) {
                    enemyReady = true;
                    setReady(data.id);
                    if (ready)
                        multiplayerGameLoop(socket);
                }
            });

            socket.on("checkOtherPlayers", data => {
                if(data.lobby === lobbyId) {
                    data.playersArray.forEach((player, id) => {
                        if (player.connected) {
                            let playerClass = `#Player${parseInt(id) + 1}`;
                            console.log(playerClass);
                            console.log(document.querySelector(`${playerClass} .Connected span`));
                            document.querySelector(`${playerClass} .Connected span`).classList.toggle("green");
                            if (parseInt(id) === playerId)
                                document.querySelector(playerClass).style.fontWeight = "bold";
                        }
                        if (player.ready) {
                            setReady(id);
                            if (id !== playerId)
                                enemyReady = true;
                        }
                    });
                }
            });

            socket.on("playerConnection", data => {
                if(data.lobby === lobbyId) {
                    console.log("Player", data.id, "has (dis)connected");
                    let player = `#Player${parseInt(data.id) + 1}`;
                    document.querySelector(`${player} .Connected span`).classList.toggle("green");
                    if (parseInt(data.id) === playerId)
                        document.querySelector(player).style.fontWeight = "bold";
                }
            });
        }
    });
}


//singleplayer game logic
function startSingleplayerGame(){
    if(dock.children.length === 0) {
        rotateButton.classList.add('Hidden');
        readyButton.classList.add('Hidden');
        shipTypes.slice().reverse().forEach(ship => generateShip(computerLogicBoardArray, allComputerBoardCells, ship.size, ship.name));
        allComputerBoardCells.forEach(cell => cell.addEventListener("click", playerTurn))
        turnLabel.textContent = "Turn: Player";
        infoLabel.textContent = "Info: Shoot enemy ships";
    }
    else
        infoLabel.textContent = "Info: Place all your ships first";
}

function singleplayerCheckWin(nextUser){
    let allShipLength = 0;
    shipTypes.forEach(ship => {allShipLength += ship.size;});
    console.log(allShipLength, playerHitCount, computerHitCount);
    if(playerHitCount === allShipLength){
        turn = "";
        infoLabel.textContent = "Info: Player won!";
        modalWindow.classList.remove("Hidden");
        modalOverlay.classList.remove("Hidden");
        modalHeader.textContent = "You've won!";
        gameOver = true;
    }
    else if(computerHitCount === allShipLength) {
        turn = "";
        infoLabel.textContent = "Info: Computer won!";
        modalWindow.classList.remove("Hidden");
        modalOverlay.classList.remove("Hidden");
        modalHeader.textContent = "You've lost";
        gameOver = true;
    }
    else {
        turn = nextUser;
        console.log(`Turn: ${nextUser}`);
        if(nextUser === "player"){
            infoLabel.textContent = "Info: Shoot enemy ships";
            turnLabel.textContent = "Turn: Player";
        }
        else{
            setTimeout(computerTurn, 1500);
        }
    }
}

//multiplayer game logic
function multiplayerPlayerTurn(classList){
    if(!gameOver){
        let targetClasses = Object.values(classList);
        if (targetClasses.includes("busy")) {
            allComputerBoardCells[playerPreviousShotId].classList.add("Destroyed");
            let linearHitCoord = playerPreviousShotId;
            let digitsArray;
            if(linearHitCoord > 9) {
                digitsArray = linearHitCoord.toString().split("");
            }
            else{
                digitsArray = ["0", linearHitCoord];
            }

            let hitCartesianCoords =
                {
                    x: Number(digitsArray[0]),
                    y: Number(digitsArray[1])
                };

            targetClasses = targetClasses.filter(className => className !== "BoardCell");
            targetClasses = targetClasses.filter(className => className !== "Destroyed");
            targetClasses = targetClasses.filter(className => className !== "busy");
            playerHitArray.push(new Hit(targetClasses[0].toString(), hitCartesianCoords.x, hitCartesianCoords.y));
            playerHitCount++;
            console.log(playerHitArray);

            infoLabel.textContent = "Info: You've shot an enemy's ship";
        } else {
            allComputerBoardCells[playerPreviousShotId].classList.add("Empty");
            infoLabel.textContent = "Info: You've missed";
        }
        multiplayersingleplayerCheckWin();
    }

}

function multiplayerEnemyTurn(linearCoordinate){
    if(!gameOver) {
        if (allPlayerBoardCells[linearCoordinate].classList.contains("busy")) {
            allPlayerBoardCells[linearCoordinate].classList.add("Destroyed");

            let digitsArray;
            if(linearCoordinate > 9) {
                digitsArray = linearCoordinate.toString().split("");
            }
            else{
                digitsArray = ["0", linearCoordinate];
            }

            let cartesianCoords =
                {
                    x: Number(digitsArray[0]),
                    y: Number(digitsArray[1])
                };

            let targetClasses = Array.from(allPlayerBoardCells[linearCoordinate].classList);
            targetClasses = targetClasses.filter(className => className !== "BoardCell");
            targetClasses = targetClasses.filter(className => className !== "Destroyed");
            targetClasses = targetClasses.filter(className => className !== "busy");
            computerHitArray.push(new Hit(targetClasses[0].toString(), cartesianCoords.x, cartesianCoords.y));
            computerHitCount++;
            console.log(computerHitArray);

            infoLabel.textContent = "Info: Enemy has shot your ship";
        } else {
            allPlayerBoardCells[linearCoordinate].classList.add("Empty");
            infoLabel.textContent = "Info: Enemy has missed";
        }
        multiplayersingleplayerCheckWin();
        turnLabel.textContent = "Turn: Player";
        turn = "player";
    }
}

function multiplayerGameLoop(socket){
    if(gameOver) return;
    if(dock.children.length !== 0)
        infoLabel.textContent = "Info: Place all your ships first";
    else if(!ready){
        rotateButton.classList.add('Hidden');
        readyButton.classList.add('Hidden');
        socket.emit("playerReady", allPlayerBoardCells);
        ready = true;
        setReady(playerId);
    }

    if(ready && enemyReady){
        if(turn === "player"){
            turnLabel.textContent = "Turn: Player";
            infoLabel.textContent = "Info: Shoot enemy's ships";
        }
        if(turn === "enemy"){
            turnLabel.textContent = "Turn: Enemy";
        }
    }
    if(ready && !enemyReady)
        infoLabel.textContent = "Info: Wait for the enemy to be ready";
}

function multiplayersingleplayerCheckWin(){
    let allShipLength = 0;
    shipTypes.forEach(ship => {allShipLength += ship.size;});
    console.log(allShipLength, playerHitCount, computerHitCount);
    if(playerHitCount === allShipLength){
        turn = "";
        infoLabel.textContent = "Info: You won!";
        modalWindow.classList.remove("Hidden");
        modalOverlay.classList.remove("Hidden");
        modalHeader.textContent = "You've won!";
        gameOver = true;
    }
    else if(computerHitCount === allShipLength) {
        turn = "";
        infoLabel.textContent = "Info: Enemy won!";
        modalWindow.classList.remove("Hidden");
        modalOverlay.classList.remove("Hidden");
        modalHeader.textContent = "You've lost";
        gameOver = true;
    }
}


//computer logic
function generateShip(boardArray, allBoardCells, shipSize, shipName){
    let randomLinearCoordinate = Math.round(Math.random() * (boardSize * boardSize - 1));
    let digitsArray;
    if(randomLinearCoordinate > 9) {
        digitsArray = randomLinearCoordinate.toString().split("");
    }
    else{
        digitsArray = ["0", randomLinearCoordinate];
    }

    let randomCartesianCoordinate =
        {
            x: Number(digitsArray[0]),
            y: Number(digitsArray[1])
        };


    let isHorizontal = Math.random() < 0.5;

    if(checkBorderCollision(boardArray, allBoardCells, randomCartesianCoordinate, shipSize, isHorizontal) && checkShipCollision(boardArray, allBoardCells, randomCartesianCoordinate, shipSize, isHorizontal)){
        if(isHorizontal) {
            for (let i = 0; i < shipSize; ++i) {
                allBoardCells[randomCartesianCoordinate.x * 10 + randomCartesianCoordinate.y + i].classList.add("busy");
                allBoardCells[randomCartesianCoordinate.x * 10 + randomCartesianCoordinate.y + i].classList.add(shipName);
                boardArray[randomCartesianCoordinate.x][randomCartesianCoordinate.y + i] = 1;
            }
        }
        else{
            for (let i = 0; i < shipSize; ++i) {
                allBoardCells[(randomCartesianCoordinate.x + i) * 10 + randomCartesianCoordinate.y].classList.add("busy");
                allBoardCells[(randomCartesianCoordinate.x + i) * 10 + randomCartesianCoordinate.y].classList.add(shipName);
                boardArray[randomCartesianCoordinate.x + i][randomCartesianCoordinate.y] = 1;
            }
        }
        //console.log("Checking", shipName, shipSize, randomCartesianCoordinate, isHorizontal, "successful");
    }
    else {
        //console.log("Checking", shipName, shipSize, randomCartesianCoordinate, isHorizontal, "failed");
        generateShip(boardArray, allBoardCells, shipSize, shipName);
    }
    //console.log(boardArray);
}

function computerTurn(){
    let foundShipCell = false;
    if(!gameOver && turn === "computer"){
        turnLabel.textContent = "Turn: Computer";
        infoLabel.textContent = "Info: Computer is making its turn...";

        setTimeout(() => {
            let linearCoordinate, cartesianCoordinate;
            if(!computerAnalysedShip.focused) {
                let randomCoordinate = Math.floor(Math.random() * boardSize * boardSize);
                let digitsArray;
                if (randomCoordinate > 9) {
                    digitsArray = randomCoordinate.toString().split("");
                } else {
                    digitsArray = ["0", randomCoordinate];
                }

                let randomCartesianCoordinate =
                    {
                        x: Number(digitsArray[0]),
                        y: Number(digitsArray[1])
                    };

                while (computerLogicShootingArray[randomCartesianCoordinate.x][randomCartesianCoordinate.y] === 1) {
                    randomCoordinate = Math.floor(Math.random() * boardSize * boardSize);
                    if (randomCoordinate > 9) {
                        digitsArray = randomCoordinate.toString().split("");
                    } else {
                        digitsArray = ["0", randomCoordinate];
                    }

                    randomCartesianCoordinate = {
                        x: Number(digitsArray[0]),
                        y: Number(digitsArray[1])
                    };
                }
                linearCoordinate = randomCoordinate;
                cartesianCoordinate = randomCartesianCoordinate;
                if(allPlayerBoardCells[linearCoordinate].classList.contains("busy")){
                    computerAnalysedShip.focused = true;
                    computerAnalysedShip.directionSeekMode = true;
                    computerAnalysedShip.x = cartesianCoordinate.x;
                    computerAnalysedShip.y = cartesianCoordinate.y;
                    foundShipCell = true;
                }
            }
            else if(computerAnalysedShip.directionSeekMode){
                //seek direction
                let shiftX, shiftY;
                switch (computerAnalysedShip.directionSeekCounter) {
                    case 0:
                        shiftX = -1;
                        shiftY = 0;
                        break;
                    case 1:
                        shiftX = 0;
                        shiftY = 1;
                        break;
                    case 2:
                        shiftX = 1;
                        shiftY = 0;
                        break;
                    case 3:
                        shiftX = 0;
                        shiftY = -1;
                        break;
                }

                while(computerAnalysedShip.y + shiftY < 0 || computerAnalysedShip.y + shiftY > boardSize - 1 || computerAnalysedShip.x + shiftX < 0 || computerAnalysedShip.x + shiftX > boardSize - 1 || computerLogicShootingArray[computerAnalysedShip.x + shiftX][computerAnalysedShip.y + shiftY] === 1)
                {
                    computerAnalysedShip.directionSeekCounter++;
                    switch (computerAnalysedShip.directionSeekCounter) {
                        case 0:
                            shiftX = -1;
                            shiftY = 0;
                            break;
                        case 1:
                            shiftX = 0;
                            shiftY = 1;
                            break;
                        case 2:
                            shiftX = 1;
                            shiftY = 0;
                            break;
                        case 3:
                            shiftX = 0;
                            shiftY = -1;
                            break;
                    }
                }

                linearCoordinate = (computerAnalysedShip.x + shiftX) * 10 + computerAnalysedShip.y + shiftY;

                if(checkCellForIntactShip({x: computerAnalysedShip.x, y: computerAnalysedShip.y}, shiftX, shiftY, allPlayerBoardCells)){
                    foundShipCell = true;
                    computerAnalysedShip.directionSeekMode = false;
                    computerAnalysedShip.isHorizontal = computerAnalysedShip.directionSeekCounter === 1 || computerAnalysedShip.directionSeekCounter === 3;
                    if(computerAnalysedShip.directionSeekCounter === 0 || computerAnalysedShip.directionSeekCounter === 3)
                        computerAnalysedShip.shootingSide = -1;
                    else
                        computerAnalysedShip.shootingSide = 1;
                }
                computerAnalysedShip.directionSeekCounter++;
            }
            else{
                let shootX, shootY;
                if(computerAnalysedShip.isHorizontal) {
                    shootX = computerAnalysedShip.x;
                    shootY = computerAnalysedShip.y + computerAnalysedShip.focusedCounter * computerAnalysedShip.shootingSide;
                    if(shootX < 0 || shootX >= boardSize){
                        computerAnalysedShip.focusedCounter = 1;
                        computerAnalysedShip.shootingSide *= -1;
                    }
                }
                else{
                    shootX = computerAnalysedShip.x + computerAnalysedShip.focusedCounter * computerAnalysedShip.shootingSide;
                    shootY = computerAnalysedShip.y;
                    if(shootY < 0 || shootY >= boardSize){
                        computerAnalysedShip.focusedCounter = 1;
                        computerAnalysedShip.shootingSide *= -1;
                    }
                }
                if(computerLogicShootingArray[shootX][shootY] === 1)
                    computerAnalysedShip.shootingSide *= -1;

                linearCoordinate = shootX * 10 + shootY;
                if(checkCellForIntactShip({x: shootX, y: shootY}, 0, 0, allPlayerBoardCells)){
                //if(allPlayerBoardCells[shootX * 10 + shootY].classList.contains("busy")){
                    computerAnalysedShip.focusedCounter++;
                    foundShipCell = true;
                }
                else{
                    computerAnalysedShip.focusedCounter = 1;
                    computerAnalysedShip.shootingSide *= -1;
                    foundShipCell = false;
                }
            }

            let digitsArray = [];
            if (linearCoordinate > 9) {
                digitsArray = linearCoordinate.toString().split("");
            } else {
                digitsArray = ["0", linearCoordinate];
            }

            cartesianCoordinate = {
                x: Number(digitsArray[0]),
                y: Number(digitsArray[1])
            };

            if(foundShipCell){
                computerAnalysedShip.previousShot = "destroyed";
                allPlayerBoardCells[linearCoordinate].classList.add("Destroyed");
                let targetClasses = Array.from(allPlayerBoardCells[linearCoordinate].classList);
                targetClasses = targetClasses.filter(className => className !== "BoardCell");
                targetClasses = targetClasses.filter(className => className !== "Destroyed");
                targetClasses = targetClasses.filter(className => className !== "busy");
                computerHitArray.push(new Hit(targetClasses[0].toString(), cartesianCoordinate.x, cartesianCoordinate.y));
                computerHitCount++;
                console.log(computerHitArray);
                markDiagonalsUseless(computerLogicShootingArray, cartesianCoordinate);

                let i = 0;
                while(i < computerHitArray.length && !scanForShipCells({x: computerHitArray[i].x, y: computerHitArray[i].y}, allPlayerBoardCells)) {
                    i++;
                }
                let isSunk = i >= computerHitArray.length;

                if(!isSunk)
                    infoLabel.textContent = "Info: Computer has shot your ship";
                else {
                    computerAnalysedShip = {
                        x: -1,
                        y: -1,
                        isHorizontal: undefined,
                        directionSeekMode: false,
                        directionSeekCounter: 0,
                        shootingSide: undefined,
                        focused: false,
                        focusedCounter: 2,
                        previousShot: undefined
                    };
                    infoLabel.textContent = `Info: Computer has sunk your ${targetClasses[0].toLowerCase()}`;
                    markUseless(computerLogicShootingArray, computerHitArray);
                }

            }
            else{
                computerAnalysedShip.previousShot = "empty";
                allPlayerBoardCells[linearCoordinate].classList.add("Empty");
                infoLabel.textContent = "Info: Computer has missed";
            }
            console.log("Computer shot at", cartesianCoordinate.x, cartesianCoordinate.y);
            computerLogicShootingArray[cartesianCoordinate.x][cartesianCoordinate.y] = 1;
            console.log(computerLogicShootingArray);
            console.log(computerAnalysedShip);

            setTimeout(() => {
                singleplayerCheckWin("player");
            }, 2000);
        }, 2000);
    }
}


//user interaction
dockedShips.forEach(dockedShip => dockedShip.addEventListener("dragstart", dragStart))
allPlayerBoardCells.forEach(playerBoardCell => {
    playerBoardCell.addEventListener("dragover", dragOver);
    playerBoardCell.addEventListener("drop", dropShip);
});

function rotateShips(){
    dockedShipsAngle += 90;
    dockedShipsAngle = dockedShipsAngle === 360 ? 0 : dockedShipsAngle;
    dockedShips.forEach(dockedShip => dockedShip.style.transform = `rotate(${dockedShipsAngle}deg)`);
    //console.log(dockedShipsAngle);
}

function setReady(playerId){
    let player = `#Player${parseInt(playerId) + 1}`;
    document.querySelector(`${player} .Ready span`).classList.toggle("green");
}

function dragStart(e){
    draggedShip = e.target;
}

function dragOver(e){
    e.preventDefault();
}

function dropShip(e){
    let dropCellId = e.target.id;
    let isHorizontal = dockedShipsAngle === 0 || dockedShipsAngle === 180;
    if(addPlayerShip(playerLogicBoardArray, allPlayerBoardCells, shipTypes[draggedShip.id], Number(dropCellId), isHorizontal))
        draggedShip.remove();
}

function addPlayerShip(boardArray, allBoardCells, ship, dropCell, isHorizontal){
    let digitsArray;
    if(dropCell > 9) {
        digitsArray = dropCell.toString().split("");
    }
    else{
        digitsArray = ["0", dropCell];
    }

    let dropCartesianCoordinate =
        {
            x: Number(digitsArray[0]),
            y: Number(digitsArray[1])
        };

    if(checkBorderCollision(boardArray, allBoardCells, dropCartesianCoordinate, ship.size, isHorizontal) && checkShipCollision(boardArray, allBoardCells, dropCartesianCoordinate, ship.size, isHorizontal)){
        if(isHorizontal) {
            for (let i = 0; i < ship.size; ++i) {
                allBoardCells[dropCartesianCoordinate.x * 10 + dropCartesianCoordinate.y + i].classList.add("busy");
                allBoardCells[dropCartesianCoordinate.x * 10 + dropCartesianCoordinate.y + i].classList.add(ship.name);
                boardArray[dropCartesianCoordinate.x][dropCartesianCoordinate.y + i] = 1;
            }
        }
        else{
            for (let i = 0; i < ship.size; ++i) {
                allBoardCells[(dropCartesianCoordinate.x + i) * 10 + dropCartesianCoordinate.y].classList.add("busy");
                allBoardCells[(dropCartesianCoordinate.x + i) * 10 + dropCartesianCoordinate.y].classList.add(ship.name);
                boardArray[dropCartesianCoordinate.x + i][dropCartesianCoordinate.y] = 1;
            }
        }
        //console.log("Checking", ship.name, ship.size, dropCartesianCoordinate, isHorizontal, "successful");
        return true;
    }
    //console.log("Checking", ship.name, ship.size, dropCartesianCoordinate, isHorizontal, "failed");
    return false;
}

function playerTurn(e){
    if(!gameOver && turn === "player"){
        if(!e.target.classList.contains("Destroyed") && !e.target.classList.contains("Empty")) {
            if (e.target.classList.contains("busy")) {
                e.target.classList.add("Destroyed");

                let linearHitCoord = Number(e.target.id);
                let digitsArray;
                if(linearHitCoord > 9) {
                    digitsArray = linearHitCoord.toString().split("");
                }
                else{
                    digitsArray = ["0", linearHitCoord];
                }

                let hitCartesianCoords =
                    {
                        x: Number(digitsArray[0]),
                        y: Number(digitsArray[1])
                    };

                let targetClasses = Array.from(e.target.classList);
                targetClasses = targetClasses.filter(className => className !== "BoardCell");
                targetClasses = targetClasses.filter(className => className !== "Destroyed");
                targetClasses = targetClasses.filter(className => className !== "busy");
                playerHitArray.push(new Hit(targetClasses[0].toString(), hitCartesianCoords.x, hitCartesianCoords.y));
                playerHitCount++;
                console.log(playerHitArray);

                let i = 0;
                while(i < playerHitArray.length && !scanForShipCells({x: playerHitArray[i].x, y: playerHitArray[i].y}, allComputerBoardCells)) {
                    i++;
                }
                let isSunk = i >= playerHitArray.length;

                if(!isSunk)
                    infoLabel.textContent = "Info: You've shot a computer's ship";
                else {
                    infoLabel.textContent = `Info: You've sunk a computer's ${targetClasses[0].toLowerCase()}`;
                    playerHitArray = [];
                }

            } else {
                e.target.classList.add("Empty");
                infoLabel.textContent = "Info: You've missed";
            }
            singleplayerCheckWin("computer");
        }
    }
}

//utility
function clamp(val, min, max){
    return Math.min(Math.max(val, min), max);
}

function scanForShipCells(hitCoords, board){
    //top
    if(checkCellForIntactShip(hitCoords, -1, 0, board))
        return true;
    //topright
    if(checkCellForIntactShip(hitCoords, -1, 1, board))
        return true;
    //right
    if(checkCellForIntactShip(hitCoords, 0, 1, board))
        return true;
    //bottomright
    if(checkCellForIntactShip(hitCoords, 1, 1, board))
        return true;
    //bottom
    if(checkCellForIntactShip(hitCoords, 1, 0, board))
        return true;
    //bottomleft
    if(checkCellForIntactShip(hitCoords, 1, -1, board))
        return true;
    //left
    if(checkCellForIntactShip(hitCoords, 0, -1, board))
        return true;
    //topleft
    if(checkCellForIntactShip(hitCoords, -1, -1, board))
        return true;
    return false;
}

function checkCellForIntactShip(coords, xShift, yShift, board){
    let x = clamp(coords.x + xShift, 0, 9);
    let y = clamp(coords.y + yShift, 0, 9);
    console.log("Checking", x, y, "for intact ships");
    return board[x * 10 + y].classList.contains("busy") && !board[x * 10 + y].classList.contains("Destroyed");
}

function checkBorderCollision(boardArray, allBoardCells, coords, shipSize, isHorizontal){
    if(isHorizontal){
        if(boardSize - coords.y < shipSize){
            return false;
        }
    }
    else{
        if(boardSize - coords.x < shipSize) {
            return false;
        }
    }
    return true;
}

function checkShipCollision(boardArray, allCells, coords, shipSize, isHorizontal) {
    if(isHorizontal){
        for (let i = 0; i < shipSize; ++i) {
            if (boardArray[coords.x][coords.y + i] === 1)
                return false;
        }
        for (let i = -1; i <= shipSize; ++i) {
            let x = clamp(coords.x - 1, 0, 9);
            let y = clamp(coords.y + i, 0, 9);
            if (boardArray[x][y] === 1)
                return false;
            x = clamp(coords.x + 1, 0, 9);
            if(boardArray[x][y] === 1)
                return false;
        }
        let x = clamp(coords.x, 0, 9);
        let y = clamp(coords.y - 1, 0, 9);
        if (boardArray[x][y] === 1)
            return false;
        x = clamp(coords.x, 0, 9);
        y = clamp(coords.y + shipSize, 0, 9);
        if (boardArray[x][y] === 1)
            return false;

        return true;
    }
    else {
        for (let i = 0; i < shipSize; ++i) {
            if (boardArray[coords.x + i][coords.y] === 1)
                return false;
        }
        for (let i = -1; i <= shipSize; ++i) {
            let x = clamp(coords.x + i, 0, 9);
            let y = clamp(coords.y - 1, 0, 9);
            if (boardArray[x][y] === 1)
                return false;
            y = clamp(coords.y + 1, 0, 9);
            if (boardArray[x][y] === 1)
                return false;
        }
        let x = clamp(coords.x - 1, 0, 9);
        let y = clamp(coords.y, 0, 9);
        if (boardArray[x][y] === 1)
            return false;
        x = clamp(coords.x + shipSize, 0, 9);
        y = clamp(coords.y, 0, 9);
        if (boardArray[x][y] === 1)
            return false;

        return true;
    }
}

function markDiagonalsUseless(boardLogicArray, coords){
    if(coords.x > 0 && coords.x < boardSize - 1 && coords.y > 0 && coords.y < boardSize - 1){
        //topright
        boardLogicArray[coords.x - 1][coords.y + 1] = 1;
        //bottomright
        boardLogicArray[coords.x + 1][coords.y + 1] = 1;
        //bottomleft
        boardLogicArray[coords.x + 1][coords.y - 1] = 1;
        //topleft
        boardLogicArray[coords.x - 1][coords.y - 1] = 1;
    }
    else if(coords.x === 0){
        if(coords.y === 0)
            //bottomright
            boardLogicArray[coords.x + 1][coords.y + 1] = 1;
        else if(coords.y === boardSize - 1)
            //bottomleft
            boardLogicArray[coords.x + 1][coords.y - 1] = 1;
        else{
            //bottomright
            boardLogicArray[coords.x + 1][coords.y + 1] = 1;
            //bottomleft
            boardLogicArray[coords.x + 1][coords.y - 1] = 1;
        }
    }
    else if(coords.x === boardSize - 1){
        if(coords.y === 0)
            //topright
            boardLogicArray[coords.x - 1][coords.y + 1] = 1;
        else if(coords.y === boardSize - 1)
            //topleft
            boardLogicArray[coords.x - 1][coords.y - 1] = 1;
        else{
            //topright
            boardLogicArray[coords.x - 1][coords.y + 1] = 1;
            //topleft
            boardLogicArray[coords.x - 1][coords.y - 1] = 1;
        }
    }
    else if(coords.y === 0){
        if(coords.x === 0)
            //bottomright
            boardLogicArray[coords.x + 1][coords.y + 1] = 1;
        else if(coords.x === boardSize - 1)
            //topright
            boardLogicArray[coords.x - 1][coords.y + 1] = 1;
        else{
            //topright
            boardLogicArray[coords.x - 1][coords.y + 1] = 1;
            //bottomright
            boardLogicArray[coords.x + 1][coords.y + 1] = 1;
        }
    }
    else if(coords.y === boardSize - 1){
        if(coords.x === 0)
            //bottomleft
            boardLogicArray[coords.x + 1][coords.y - 1] = 1;
        else if(coords.x === boardSize - 1)
            //topleft
            boardLogicArray[coords.x - 1][coords.y - 1] = 1;
        else{
            //bottomleft
            boardLogicArray[coords.x + 1][coords.y - 1] = 1;
            //topleft
            boardLogicArray[coords.x - 1][coords.y - 1] = 1;
        }
    }
}

function markUseless(boardLogicArray, hitArray){
    while(hitArray.length > 0) {
        let hit = hitArray.shift();
        //top
        boardLogicArray[clamp(hit.x - 1, 0, 9)][clamp(hit.y, 0, 9)] = 1;
        //topright
        boardLogicArray[clamp(hit.x - 1, 0, 9)][clamp(hit.y + 1, 0, 9)] = 1;
        //right
        boardLogicArray[clamp(hit.x, 0, 9)][clamp(hit.y + 1, 0, 9)] = 1;
        //bottomright
        boardLogicArray[clamp(hit.x + 1, 0, 9)][clamp(hit.y + 1, 0, 9)] = 1;
        //bottom
        boardLogicArray[clamp(hit.x + 1, 0, 9)][clamp(hit.y, 0, 9)] = 1;
        //bottomleft
        boardLogicArray[clamp(hit.x + 1, 0, 9)][clamp(hit.y - 1, 0, 9)] = 1;
        //left
        boardLogicArray[clamp(hit.x, 0, 9)][clamp(hit.y - 1, 0, 9)] = 1;
        //topleft
        boardLogicArray[clamp(hit.x - 1, 0, 9)][clamp(hit.y - 1, 0, 9)] = 1;
    }
}