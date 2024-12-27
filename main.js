/*-----------------------------------------------------*/
// IMPORTS //
/*-----------------------------------------------------*/

// import * as THREE from 'three';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
// import * as FBX from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/FBXLoader.js';
import { FBXLoader } from './FBXLoader.js'
import {
    alignHUBToCamera,
    initializeTextSprite,
    createSprite,
    updateAnimations,
    loadResourcesFromJson,
    updateTextSprite
} from './myFunctions.js'
import seedrandom from 'https://cdn.skypack.dev/seedrandom';

/*-----------------------------------------------------*/
// REVISION NUMBER
/*-----------------------------------------------------*/

// revision hash
const revision = "1.039"; // Replace with actual Git hash

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
const gravitySpeedDecrement = isMobile() ? 35 * 0.9 : 35;
const jumpInitVerticalSpeed = 12;

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

let resourcesDict; //resources dictionary
let matDict; //material dictionary
let charaDict; //meshes dictionary
let charaMixer;
let scoreSprite, livesSprite, messageSprite;
let player;
let grounds = [];
let citySprites = [];
let buildMat, buildHalfMat;
// let chara;
// let loader;
// let mixer;
// let matDictV = {};
const keys = {};
let playerVerticalSpeed = 0;
let isTouchingGround = null;
let gameOver = false;
let hasJumped = false;
let keyAPressed = false;//TODO: make it a dictionary
let keyPPressed = false;
let liveSpriteInitOffset, scoreSpriteInitOffset, messageSpriteInitOffset;
let citySpriteLeftIdx = 0;
let frameCount = 0;
let deltaTime;
let pause = false;
let nextColIdx = 0;
let runningAction;

/*-----------------------------------------------------*/
// STEP 0
// create scene, camera and renderer
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

// clock
const clock = new THREE.Clock();

// Handle keyboard input
document.addEventListener('keydown', (event) => keys[event.code] = true);
document.addEventListener('keyup', (event) => keys[event.code] = false);
document.addEventListener('touchstart', jump);

/*-----------------------------------------------------*/
// STEP 1
// fetch JSON and populate material dictionary
/*-----------------------------------------------------*/

const ResourceLoadingPromise = loadResourcesFromJson('resources.json').then(
    resources => {
        resourcesDict = resources;
        matDict = resourcesDict["IMAGES"];
        charaDict = resourcesDict["MESHES"]["CHARA"];
        charaMixer = charaDict["MIXER"];
    }
).catch(error => {
    console.error('Error loading JSON:', error);
});

/*-----------------------------------------------------*/
// STEP 3
// create SCENE if everything loaded correctly
/*-----------------------------------------------------*/

const sceneCreated = ResourceLoadingPromise.then(() => {

    //city
    let posX = -citySpriteScale;
    for (let i = 0; i < numCitySprites; i++) {
        const citySprite = createSprite(matDict.CITY, posX, citySpriteDepth, citySpriteHeight, citySpriteScale, 0)
        scene.add(citySprite);
        citySprite.visible = !hideBg;
        citySprites.push(citySprite);
        posX += citySpriteScale;
    }

    const groundGeom = new THREE.BoxGeometry();
    buildMat = matDict.BUILDING;
    buildHalfMat = matDict.HALFBUILDING;
    // buildHalfMat = new THREE.MeshBasicMaterial({ color: 0xB8B8B8 });
    let groundMat = buildMat;

    posX = ((groundLength / 2));//- 0.01); //small offset
    let curScaleX = groundLength
    for (let i = 0; i < numPlat; i++) {
        curScaleX = (i != 0) ? (groundLength * getRandom(groundLengthRatioMin, groundLengthRatioMax)) : groundLength;
        groundMat = buildMat;
        if ((curScaleX / groundHeight) < 0.15)
            groundMat = buildHalfMat;
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.scale.set(curScaleX, groundHeight, curScaleX);
        ground.position.set(posX,
            (i != 0) ? (groundCenterY + getRandom(groundMinY, groundMaxY)) : groundCenterY,
            0);
        posX += groundLength + groundGap
        // ground.visible = false;
        scene.add(ground);
        grounds.push(ground);
    }

    //player
    const playerGeometry = new THREE.BoxGeometry();
    playerGeometry.translate(0, 0.5, 0);
    const playerMaterial = matDict.CRATE;
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.visible = false; // Hide the player mesh from the scene
    scene.add(player);
    camera.lookAt(player.position);

    //character
    let chara = charaDict["MESH"]
    let charaScale = 0.013;
    chara.scale.set(charaScale, charaScale, charaScale); // Scale down if model is too large
    chara.rotation.set(0, Math.PI / 2, 0);
    chara.position.set(0, -0.5, 0);
    scene.add(chara);

    //HUD

    scoreSprite = initializeTextSprite(document, "Score: 0", camera, 0.1, 'black', 'right', 'top', 0.3, 0.2);
    livesSprite = initializeTextSprite(document, "Lives: 3", camera, 0.1, 'black', 'left', 'top', 0.3, 0.2);
    // messageSprite = initializeTextSprite(document, "Get ready!\n(tap to jump)\n3", camera, 0.2, 'Red');
    messageSprite = initializeTextSprite(document, "Get ready!", camera, 0.2, 'Red');
    // messageSprite.visible = false;

    scene.add(livesSprite);
    scene.add(scoreSprite);
    scene.add(messageSprite);

    //death plane (debug)
    if (showDeathPlane) {
        const deathPlane = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0), side: THREE.DoubleSide }));
        deathPlane.rotation.x = (Math.PI / 2);
        deathPlane.position.set(0, deathPlaneHeight, 0);
        deathPlane.scale.set(30, 30, 30);
        scene.add(deathPlane);
    }

})

/*-----------------------------------------------------*/
// STEP 4
// Main gameplay loop
/*-----------------------------------------------------*/

// sceneCreated.then(() => getReady()).then(() => animate());

async function setupScene() {
    try {
        await sceneCreated;         // Wait for the scene to be created
        await waitFor(1);
        updateTextSprite(messageSprite, "2");
        renderer.render(scene, camera);
        await getReady(1, "1");          // Wait for 3 seconds while updating HUD and rendering
        await getReady(1, "Go!");          // Wait for 3 seconds while updating HUD and rendering
        messageSprite.visible = false;
        runningAction = charaDict["ANIMATIONS"]["RUNNING"];
        runningAction.play();
        animate();                  // Start animation loop
    } catch (error) {
        console.error("Error in scene setup or animation:", error);
    }
}

setupScene();

/*-----------------------------------------------------*/
// GAMEPLAY FUNCTIONS
/*-----------------------------------------------------*/

// isDead function

function isDead() {
    if (player.position.y <= deathPlaneHeight) {
        console.log("GAMEOVER")
        messageSprite.innerText = "Game Over";
        messageSprite.visible = true;
        // renderer.render(scene, camera);
        doPause();
        return true;
    } else {
        return false;
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
    if (isTouchingGround != null && !hasJumped) {
        console.log('JUMP');
        playerVerticalSpeed += jumpInitVerticalSpeed;
        hasJumped = true;
    }
}

// move Player function

function movePlayer(delta) {
    if (freeCam) {
        const moveCam = moveSpeed * delta;
        if (keys['ArrowUp']) camera.position.z -= moveCam;
        if (keys['ArrowDown']) camera.position.z += moveCam;
        if (keys['ArrowLeft']) camera.position.x -= moveCam;
        if (keys['ArrowRight']) camera.position.x += moveCam;
        if (keys['KeyZ']) camera.position.y += moveCam;
        if (keys['KeyX']) camera.position.y -= moveCam;
        // camera.lookAt(chara);
    }
    if (keys['KeyP']) {
        if (!keyPPressed) { doPause(); keyPPressed = true; }
    } else {
        keyPPressed = false;
    }

    if (pause)
        return;

    if (keys['Space']) {
        jump();
    } else {
        hasJumped = false;
    }
    if (keys['KeyA']
        || true
    ) {
        if (!keyAPressed) {
            player.position.y += playerVerticalSpeed * delta;
            isTouchingGround = isCollidingGrounds(); //collision check
            gameOver = isDead();
            if (isTouchingGround == null) {
                playerVerticalSpeed -= gravitySpeedDecrement * delta;
            } else {
                player.position.y = isTouchingGround; // Calculate top height
                playerVerticalSpeed = 0;
            }
            // keyAPressed = true;
        }
    } else {
        keyAPressed = false;
    }

    //     Check for collision
    // if (isColliding(player, ground)) {
    //     console.log('Collision detected!');
    // }
    let chara = charaDict["MESH"]
    chara.position.y = player.position.y;

}

// updateHUD function

function updateHUD() {
    if (frameCount < 3) {
        liveSpriteInitOffset = alignHUBToCamera(livesSprite, camera, "left", "top", 0.3, 0.2);
        scoreSpriteInitOffset = alignHUBToCamera(scoreSprite, camera, "right", "top", 0.3, 0.2);
        messageSpriteInitOffset = alignHUBToCamera(messageSprite, camera);
    } else {
        livesSprite.position.copy(camera.position).add(liveSpriteInitOffset);
        scoreSprite.position.copy(camera.position).add(scoreSpriteInitOffset);
        messageSprite.position.copy(camera.position).add(messageSpriteInitOffset);
    }
}

// moveGrounds function

function moveGrounds(delta) {
    grounds.forEach(ground => moveGround(ground, delta));
}

function moveGround(thisGround, delta) {
    thisGround.position.x -= groundSpeed * delta;
    if (thisGround.position.x < groundLimit) {
        let curScaleX = groundLength * getRandom(groundLengthRatioMin, groundLengthRatioMax);
        let groundMat = buildMat;
        if ((curScaleX / groundHeight) < 0.15)
            groundMat = buildHalfMat;
        thisGround.material = groundMat;
        thisGround.position.x = groundInitPos;
        thisGround.scale.set(curScaleX, groundHeight, curScaleX);
        thisGround.position.y = groundCenterY + getRandom(groundMinY, groundMaxY)
    }

}

// moveBG function

function moveBG(delta) {
    let leftSpritePosX = citySprites[citySpriteLeftIdx].position.x - (bgSpeed * delta);
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
    frameCount++;
    requestAnimationFrame(animate);
    deltaTime = clock.getDelta(); // Time elapsed since last frame
    movePlayer(deltaTime);
    updateHUD();
    if (!pause) {
        moveGrounds(deltaTime);
        moveBG(deltaTime);
        updateAnimations(charaMixer, deltaTime);
    }
    renderer.render(scene, camera);
}

function waitFor(seconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000); // Resolve the promise after 3 seconds
    });
}

function getReady(seconds) {
    updateHUD();
    // messageSprite.innerText = text;
    renderer.render(scene, camera);
    return waitFor(seconds);
}
