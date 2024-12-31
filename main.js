/*-----------------------------------------------------*/
// IMPORTS //
/*-----------------------------------------------------*/

// import * as THREE from 'three';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import {
    createPlane,
    updateAnimations,
    loadResourcesFromJson,
    waitFor
} from './myFunctions.js'
import seedrandom from 'https://cdn.skypack.dev/seedrandom';

/*-----------------------------------------------------*/
// REVISION NUMBER
/*-----------------------------------------------------*/

// revision hash
const revision = "1.056"; // Replace with actual Git hash

// Add it to the div
document.getElementById('revision-info').innerText = `Version: ${revision}`;

/*-----------------------------------------------------*/
// PSEUDO RANDOMNESS
/*-----------------------------------------------------*/

// pseudoseed
// const rng = seedrandom('666'); // Create a seeded random generator
const rng = seedrandom(); // Create a seeded random generator

// Function to generate a random position between min and max using rng()
export function getRandom(min, max) {
    return rng() * (max - min) + min; // Random number between min and max
}

/*-----------------------------------------------------*/
// PLATFORM MANAGEMENT
/*-----------------------------------------------------*/

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
// Usage
if (isMobile()) {
    console.log("You're on a mobile device!");
} else {
    console.log("You're on a desktop!");
}

/*-----------------------------------------------------*/
// DEBUG VARIABLES
/*-----------------------------------------------------*/

let debug = false;
let farView = false;
let hideBg = false;
let freeCam = false;
let showDeathPlane = false;

if (0) {
    debug = true;
    farView = false;
    hideBg = false;
    freeCam = true;
    showDeathPlane = false;
}

/*-----------------------------------------------------*/
// GAMEPLAY CONSTANTS
/*-----------------------------------------------------*/

const numPlat = 8
const numPlatToTheLeft = 4
const groundLength = 6;
const groundGap = 2;

//speeds
const moveSpeed = 5;
const groundSpeed = debug ? 0 : (isMobile() ? 9 * 0.9 : 9);
// const gravitySpeedDecrement = isMobile() ? 35 * 0.9 : 35;
// const jumpInitVerticalSpeed = 12;
const gravitySpeedDecrement = isMobile() ? 50 * 0.95 : 50;
const jumpInitVerticalSpeed = 15;

//ground variables
const groundInitPos = (numPlat - numPlatToTheLeft) * (groundLength + groundGap);
const groundLimit = -numPlatToTheLeft * (groundLength + groundGap);
const groundMinY = -1.5;
const groundMaxY = 1.5;
const groundLengthRatioMin = 0.35;
const groundLengthRatioMax = 1;
const groundHeight = 30;
const groundCenterY = -0.5 - (groundHeight / 2);
const deathPlaneHeight = -10;

// camera offset position
const cameraOffsetZ = farView ? 150 : 15;
// const cameraOffsetY = debug? 150:2;
const cameraOffsetY = 2;

// background variables
const numCitySprites = 4;
const numCitySpritesToTheLeft = 1;
const citySpriteScale = 50;
const citySpriteDepth = -5;
const citySpriteHeight = -8;
const bgSpeed = groundSpeed * 0.75;
const bgLimit = -(numCitySpritesToTheLeft + 1) * citySpriteScale;
const bgInitPos = (numCitySprites - numCitySpritesToTheLeft - 1) * citySpriteScale;

/*-----------------------------------------------------*/
// GAMEPLAY GLOBAL VARIABLES
/*-----------------------------------------------------*/

let resourcesDict = {}; //resources dictionary
let matDict = {}; //material dictionary
let charaDict = {}; //meshes dictionary
let charaMixer;
let player;
let grounds = [];
let citySprites = [];
const keys = {};
let playerVerticalSpeed = 0;
let isTouchingGround = null;
let citySpriteLeftIdx = 0;
let frameCount = 0;
let deltaTime;
let pause = false;
let nextColIdx = 0;
let runningAction;
let score = 0;
let newgroundSpeed = groundSpeed;
let newbgSpeed = bgSpeed;
let lives = 3;
let messageScreen = "";
let gameOver = false;
let gameActions = {}
//TODO create a game state + game state manager

/*-----------------------------------------------------*/
// SAVE STATES
/*-----------------------------------------------------*/

// let citySpritesInitPositions = [];

/*-----------------------------------------------------*/
// GAME ACTIONS TO KEY MAPPING AND REVERSE
/*-----------------------------------------------------*/
let gameActionToKeyMap = {
    //camera actions (debug)
    moveCamUp: { key: 'ArrowUp' },
    moveCamDown: { key: 'ArrowDown' },
    moveCamRight: { key: 'ArrowRight' },
    moveCamLeft: { key: 'ArrowLeft' },
    moveCamFront: { key: 'KeyZ' },
    moveCamBack: { key: 'KeyX' },
    //debug actions
    moveByOneFrame: { key: 'KeyA', OnPress: true }, //triggered once only at keydown
    //pause
    pause: { key: 'KeyP', OnRelease: true }, //triggered once only at release
    //gameplay actions
    jump: { key: 'Space', OnPress: true },
    forceGameOver: { key: 'KeyO', OnPress: true },
};
// Reverse the mapping to get the action from the key (press or release)
let keyPressToGameActionMap = {};
let keyPressOnceToGameActionMap = {};
let keyReleaseToGameActionMap = {};
for (let gameAction in gameActionToKeyMap) {
    let mapping = gameActionToKeyMap[gameAction]
    if (mapping.OnRelease) {
        keyReleaseToGameActionMap[mapping.key] = gameAction;
    } else if (mapping.OnPress) {
        keyPressOnceToGameActionMap[mapping.key] = gameAction;
    } else {
        keyPressToGameActionMap[mapping.key] = gameAction;
    }
}

/*-----------------------------------------------------*/
// PRELIMINARIES
// create scene, camera and renderer
// HUB overlay
// clock and input listeners
/*-----------------------------------------------------*/

// Dynamically create a canvas element
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// const cameraOffsetY = 5;
camera.position.z = cameraOffsetZ;
camera.position.y = cameraOffsetY;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a 2D canvas for overlay
const hudCanvas = document.getElementById('hud-canvas');
hudCanvas.width = window.innerWidth;
hudCanvas.height = window.innerHeight;

const hudContext = hudCanvas.getContext('2d');

// Clear the canvas (transparent background)
hudContext.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

// Example: Draw a simple text overlay (debugging HUD)
hudContext.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Semi-transparent white
hudContext.font = '20px Arial';
// hudContext.fillText('HUD Overlay', 10, 30);

// clock
const clock = new THREE.Clock();

// Handle keyboard input
document.addEventListener('keydown', (event) => {
    // keysOnPress[event.code] = !keys[event.code];
    if (keyPressToGameActionMap[event.code])   //if mapping exists
        gameActions[keyPressToGameActionMap[event.code]] = true;
    else if (keyPressOnceToGameActionMap[event.code])
        gameActions[keyPressOnceToGameActionMap[event.code]] = !keys[event.code];

    keys[event.code] = true;//true all the time when key is pressed
});
document.addEventListener('keyup', (event) => {
    // keysOnRelease[event.code] = keys[event.code];//true only once when key is released
    keys[event.code] = false;
    if (keyPressToGameActionMap[event.code])  //if mapping exists
        gameActions[keyPressToGameActionMap[event.code]] = false;
    else if (keyPressOnceToGameActionMap[event.code])
        gameActions[keyPressOnceToGameActionMap[event.code]] = false;
    else if (keyReleaseToGameActionMap[event.code]) //if mapping exists
        gameActions[keyReleaseToGameActionMap[event.code]] = true;
});
document.addEventListener('touchstart', () => {
    keys['touchstart'] = true;
    if (!pause && !gameOver) {
        jump();
    }
});
document.addEventListener('touchend', () => {
    keys['touchstart'] = false;
});
document.addEventListener('touchcancel', () => {
    keys['touchstart'] = false; // Ensure touch key resets on cancel
});
window.addEventListener('resize', () => {
    // Resize the 3D canvas
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Resize the HUD canvas
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
});


/*-----------------------------------------------------*/
// SETUP AND START GAME
/*-----------------------------------------------------*/

setupAndStartGame();








/*-----------------------------------------------------*/
/*-----------------------------------------------------*/
/*FUNCTIONS--------------------------------------------*/
/*-----------------------------------------------------*/
/*-----------------------------------------------------*/


/*-----------------------------------------------------*/
// SETUP AND START GAME function
/*-----------------------------------------------------*/

async function setupAndStartGame() {
    try {

        // load all resources into dictionaries from JSON
        resourcesDict = await loadResourcesFromJson('resources.json');
        matDict = resourcesDict.IMAGES;
        charaDict = resourcesDict.MESHES.CHARA;
        charaMixer = charaDict.MIXER;

        // create the scene
        createScene();
        let loopcount = 0;
        while (loopcount < 100) { //for the moment allow 100 replays
            loopcount++;
            //initializeScene
            initializeScene();

            // run the intro
            await intro();

            //character starts running
            runningAction = charaDict.ANIMATIONS.RUNNING;
            runningAction.play();

            // Reset the clock to start from 0
            clock.start();

            // Start animation loop
            requestAnimationFrame(animate);

            await waitForGameOver();
            runningAction.stop();

            await gameOverSequence();
        }
        console.error("max replay reached: refresh your browser", error);

    } catch (error) {
        console.error("Error in scene setup or animation:", error);
    }
}

async function promptToRestart() {
    return new Promise(resolve => {
        const checkRestartKey = () => {
            const anyTrue = Object.values(keys).some(value => value === true);
            if (anyTrue) {
                resolve();
            } else {
                requestAnimationFrame(checkRestartKey); // Keep checking on each frame
            }
        };
        //reset keys in case some keyUp were made out of scope and not tracked correctly
        Object.keys(keys).forEach(key => {
            delete keys[key];
        });
        checkRestartKey(); // Start checking
    });
};

/*-----------------------------------------------------*/
// intro function
/*-----------------------------------------------------*/

async function intro() {
    messageScreen = "Get Ready...";
    drawHUD();
    renderer.render(scene, camera);
    await waitFor(1);
    messageScreen = "Go!";
    drawHUD();
    renderer.render(scene, camera);
    await waitFor(1);
    messageScreen = "";
}

/*-----------------------------------------------------*/
// gameOver function
/*-----------------------------------------------------*/
async function waitForGameOver() {
    // Wait for the game over flag to be set
    await new Promise(resolve => {
        const checkGameOverInterval = setInterval(() => {
            if (gameOver) {
                clearInterval(checkGameOverInterval);  // Stop checking
                resolve();  // Resolve the promise
            }
        }, 100);  // Check every 100ms if the game is over
    });
}

async function gameOverSequence() {
    console.log("GAMEOVER")
    messageScreen = "GAMEOVER";
    drawHUD();
    renderer.render(scene, camera);
    await waitFor(1);
    messageScreen = isMobile() ? "Tap to replay" : "press any key to replay";
    drawHUD();
    renderer.render(scene, camera);
    // wait for input
    await promptToRestart();
    messageScreen = "";
    drawHUD();
    renderer.render(scene, camera);
    await waitFor(0.5);
}

/*-----------------------------------------------------*/
// GAMEPLAY FUNCTIONS
/*-----------------------------------------------------*/

// isDead function

function isDead() {
    if (player.position.y <= deathPlaneHeight) {
        gameOver = true;
    }
}

// doPause function

function doPause() {
    console.log("PAUSE");
    pause = !pause;
}

// collision detection

function isCollidingGrounds() {
    let result = null;
    let numCalculations = 0;
    // if (frameCount < 3) return true;
    for (let i = 0; i < 2; i++) { //only check current and next platform
        let idx = (i + nextColIdx) % numPlat;//start from current platform
        let ground = grounds[idx];
        result = isColliding(player, ground);
        numCalculations++;
        if (result != null) {
            if (nextColIdx != idx)
                score++;//we landed on new platform, score goes up
            nextColIdx = idx;//remember last collided platform
            break; // Exit the loop as soon as a collision is detected
        }
    }
    // console.info('numCalculations',numCalculations);
    return result;
}

function isColliding(object1, object2) {
    const box1 = new THREE.Box3().setFromObject(object1); // Bounding box of object1
    const box2 = new THREE.Box3().setFromObject(object2); // Bounding box of object2
    // Check if bounding boxes intersect
    if (box1.intersectsBox(box2)) {
        // Ensure the collision is specifically from the bottom of box1 to the top of box2
        if (box1.min.y <= box2.max.y && box1.max.y > box2.max.y) {
            // The bottom of box1 is colliding with the top of box2
            const overlapBox = box1.intersect(box2); // Calculate the overlap area

            // Get the top Y coordinate of the overlapBox
            const topY = overlapBox.max.y;
            // console.info('Collision detected. Overlap top Y:', topY);

            return topY; // Return the top Y coordinate of the overlap
        }

    }

    return null; // No collision
}

// jump function

function jump() {
    // console.log('ACTIONJUMP');
    if (isTouchingGround != null) {
        console.log('JUMP');
        playerVerticalSpeed += jumpInitVerticalSpeed;
    }
}

// move Player function
function pauseAndDebug(delta) {
    if (freeCam) {
        const moveCam = moveSpeed * delta;
        if (gameActions.moveCamUp) camera.position.z -= moveCam;
        if (gameActions.moveCamDown) camera.position.z += moveCam;
        if (gameActions.moveCamLeft) camera.position.x -= moveCam;
        if (gameActions.moveCamRight) camera.position.x += moveCam;
        if (gameActions.moveCamFront) camera.position.y += moveCam;
        if (gameActions.moveCamBack) camera.position.y -= moveCam;
        // camera.lookAt(chara);
    }
    if (debug) {
        if (gameActions.forceGameOver)
            gameOver = true;
    }

    if (gameActions.pause)
        doPause();
}

function movePlayer(delta) {

    if (gameActions.jump) jump();

    if (gameActions.moveByOneFrame
        || true
    ) {
        player.position.y += playerVerticalSpeed * delta;
        isTouchingGround = isCollidingGrounds(); //collision check
        isDead();
        if (isTouchingGround == null) {
            playerVerticalSpeed -= gravitySpeedDecrement * delta;
        } else {
            player.position.y = isTouchingGround; // Calculate top height
            playerVerticalSpeed = 0;
        }
    }

    let chara = charaDict.MESH;
    chara.position.y = player.position.y;

}

// moveGrounds function

function moveGrounds(delta) {
    grounds.forEach(ground => moveGround(ground, delta));
}

function moveGround(thisGround, delta) {
    thisGround.position.x -= newgroundSpeed * delta;
    if (thisGround.position.x < groundLimit) {
        let curScaleX = groundLength * getRandom(groundLengthRatioMin, groundLengthRatioMax);
        let groundMat = matDict.BUILDING;
        if ((curScaleX / groundHeight) < 0.15)
            groundMat = matDict.HALFBUILDING;
        thisGround.material = groundMat;
        thisGround.position.x = groundInitPos;
        thisGround.scale.set(curScaleX, groundHeight, curScaleX);
        thisGround.position.y = groundCenterY + getRandom(groundMinY, groundMaxY)
    }

}

// moveBG function

function moveBG(delta) {
    let leftSpritePosX = citySprites[citySpriteLeftIdx].position.x - (newbgSpeed * delta);
    let posX = leftSpritePosX;
    for (let i = 0; i < numCitySprites; i++) {
        let idx = (citySpriteLeftIdx + i) % numCitySprites;
        let sprite = citySprites[idx];
        sprite.position.x = posX;
        posX += citySpriteScale;
    };
    if (leftSpritePosX < bgLimit) {
        citySpriteLeftIdx = (citySpriteLeftIdx + 1) % numCitySprites;
    }
}

// Animation loop
function animate() {
    // console.log('frame',frameCount++)
    deltaTime = clock.getDelta(); // Time elapsed since last frame
    drawHUD();
    pauseAndDebug(deltaTime);
    if (!pause) {
        movePlayer(deltaTime);
        moveGrounds(deltaTime);
        moveBG(deltaTime);
        updateAnimations(charaMixer, deltaTime);
        updateSpeed();
    }
    renderer.render(scene, camera);
    frameCount++;
    //clear the onpress/onrelease actions now that they have been sampled 
    //in that loop to avoid resampling
    releaseSingleEventActions();

    if (!gameOver) {
        requestAnimationFrame(animate); //call animate recursively on next frame 
    }
}

// drawHUD loop
function drawHUD() {

    // console.log("new score is ",score);
    // Clear the canvas for redrawing
    hudContext.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

    // Text box styles
    hudContext.font = '20px Arial';
    hudContext.fillStyle = 'rgba(0, 0, 0, 0.9)';
    hudContext.textAlign = 'left';

    // Draw "Score" at the top-left corner
    hudContext.fillText(`Score: ${score}`, 10, 30); // 10px from left, 30px from top

    // Draw "Lives" at the top-right corner
    hudContext.textAlign = 'right'; // Align text to the right edge
    hudContext.fillText(`Lives: ${lives}`, hudCanvas.width - 10, 30); // 10px from right, 30px from top

    // Draw a message in the center
    hudContext.fillStyle = 'rgba(255, 0, 0, 0.9)';
    hudContext.font = '60px Arial';
    hudContext.textAlign = 'center'; // Align text to the center
    hudContext.fillText(messageScreen, hudCanvas.width / 2, hudCanvas.height / 2); // Centered horizontally and vertically
}

// createScene loop
function createScene() {

    /*--------*/
    //city background
    /*--------*/
    for (let i = 0; i < numCitySprites; i++) {
        const citySprite = createPlane(matDict.CITY)
        scene.add(citySprite);
        citySprites.push(citySprite);
    }

    /*--------*/
    //buildings
    /*--------*/
    const groundGeom = new THREE.BoxGeometry();
    for (let i = 0; i < numPlat; i++) {
        const ground = new THREE.Mesh(groundGeom, matDict.BUILDING);
        scene.add(ground);
        grounds.push(ground);
    }

    /*--------*/
    //player box (invisible/for collision only)
    /*--------*/
    const playerGeometry = new THREE.BoxGeometry();
    playerGeometry.translate(0, 0.5, 0);
    const playerMaterial = matDict.CRATE;
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.visible = false; // Hide the player mesh from the scene
    scene.add(player);
    camera.lookAt(player.position);

    /*--------*/
    //character mesh
    /*--------*/
    let chara = charaDict.MESH
    let charaScale = 0.013;
    chara.scale.set(charaScale, charaScale, charaScale); // Scale down if model is too large
    chara.rotation.set(0, Math.PI / 2, 0);
    chara.position.set(0, -0.5, 0);
    scene.add(chara);

    /*--------*/
    //death plane (debug)
    /*--------*/
    if (showDeathPlane) {
        const deathPlane = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0), side: THREE.DoubleSide }));
        deathPlane.rotation.x = (Math.PI / 2);
        deathPlane.position.set(0, deathPlaneHeight, 0);
        deathPlane.scale.set(30, 30, 30);
        scene.add(deathPlane);
    }
}

function initializeScene() {

    //reset gameOver
    gameOver = false;

    //reset pause
    pause = false;

    //clear all game actions
    gameActions = {};

    //clear score and reinitialize lives
    score = 0;
    lives = 3;

    //resets speeds
    newgroundSpeed = groundSpeed;
    newbgSpeed = bgSpeed;

    //reset message
    messageScreen = ""

    //reset collision test start id
    nextColIdx = 0;

    //initialize background first panel id
    citySpriteLeftIdx = 0;

    /*--------*/
    //city background
    /*--------*/
    let posX = -citySpriteScale;
    for (let i = 0; i < numCitySprites; i++) {
        const citySprite = citySprites[i];
        citySprite.position.set(posX, citySpriteHeight, citySpriteDepth);  // Set the position of the tree sprite in the scene
        citySprite.rotation.x = 0;
        citySprite.rotation.y = 0;
        citySprite.scale.set(citySpriteScale, citySpriteScale, citySpriteScale);
        citySprite.visible = !hideBg;
        posX += citySpriteScale;
    }

    /*--------*/
    //buildings
    /*--------*/
    let buildMat, buildHalfMat;
    buildMat = matDict.BUILDING;
    buildHalfMat = matDict.HALFBUILDING;
    let groundMat = buildMat;

    let posGroundX = ((groundLength / 2));//- 0.01); //small offset
    let curScaleX = groundLength
    for (let i = 0; i < numPlat; i++) {
        let ground = grounds[i];
        curScaleX = (i != 0) ? (groundLength * getRandom(groundLengthRatioMin, groundLengthRatioMax)) : groundLength;
        groundMat = buildMat;
        if ((curScaleX / groundHeight) < 0.15)
            groundMat = buildHalfMat;
        ground.material = groundMat;
        ground.scale.set(curScaleX, groundHeight, curScaleX);
        ground.position.set(posGroundX,
            (i != 0) ? (groundCenterY + getRandom(groundMinY, groundMaxY)) : groundCenterY,
            0);
        posGroundX += groundLength + groundGap
    }

    /*--------*/
    //player box (invisible/for collision only)
    /*--------*/
    player.position.set(0, 0, 0);

    /*--------*/
    //character mesh
    /*--------*/
    let chara = charaDict.MESH;
    chara.position.y = player.position.y;

}

// releaseSingleEventActions
function releaseSingleEventActions() {
    for (const [action, actionValue] of Object.entries(gameActions)) {
        if (actionValue) {
            let mapping = gameActionToKeyMap[action];
            if (mapping)
                if (mapping.OnPress || mapping.OnRelease) {
                    gameActions[action] = false
                    // console.log("Releasing gameaction",gameActions[action]);
                }
        }
    }
}

let ts = 70; //speed tweak variable
let ms = isMobile()? 0.15 : 0.3; //max speed gain
function updateSpeed() {
    // newgroundSpeed = groundSpeed * (1 + Math.abs(Math.sin((score / ts)*(Math.PI/2)))*0.3);

    if ((Math.floor(score / ts) % 2) == 0) {
        // console.log('accelerating', newgroundSpeed);
        newgroundSpeed = groundSpeed * (1 + ((score%ts) / ts)*ms);
    } else {
        // console.log('decelerating', newgroundSpeed);
        newgroundSpeed = groundSpeed * (1 + ((ts-(score%ts)) / ts)*ms);
    }
    newbgSpeed = 0.75 * newgroundSpeed;
}
