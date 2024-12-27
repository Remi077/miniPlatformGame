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
    loadMaterialsFromDict,
    updateAnimations,
    loadResourcesFromJson
} from './myFunctions.js'
import seedrandom from 'https://cdn.skypack.dev/seedrandom';

/*-----------------------------------------------------*/
// REVISION NUMBER
/*-----------------------------------------------------*/

// revision hash
const revision = "1.038"; // Replace with actual Git hash

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

let scoreSprite, livesSprite, gameOverSprite;
let player;
let grounds = [];
let citySprites = [];
let buildMat, buildHalfMat;
let chara;
let loader;
let mixer;
let matDictV = {};
const keys = {};
let playerVerticalSpeed = 0;
let isTouchingGround = null;
let gameOver = false;
let hasJumped = false;
let keyAPressed = false;//TODO: make it a dictionary
let keyPPressed = false;
let liveSpriteInitOffset, scoreSpriteInitOffset, gameOverSpriteInitOffset;
let citySpriteLeftIdx = 0;
let frameCount = 0;
let deltaTime;
let pause = false;
let nextColIdx = 0;

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

let MaterialLoadingPromise;
if (1) {
    MaterialLoadingPromise =
        (
            fetch('images.json')
                .then(response => response.json()) // Parse JSON
                .then(data => {
                    console.log('Loaded JSON data:', data);

                    // Use the data (which contains the URL, scale, type, etc.) to load the images and create objects
                    return loadMaterialsFromDict(data);
                }).catch(error => {
                    console.error('Error loading JSON:', error);
                })
        );
} else {
    MaterialLoadingPromise =
        (
            loadResourcesFromJson('resources.json').then(
                data => { return data["IMAGES"] }
            ).catch(error => {
                console.error('Error loading JSON:', error);
            })
        );
}
// Use top-level await to unwrap the Promise 
try {
    matDictV = await MaterialLoadingPromise;
    console.log(matDictV);
    // Now dictionary is assigned the resolved value 
} catch (error) { console.error('Error:', error); }

/*-----------------------------------------------------*/
// STEP 2
// Load FBXs after materials are loaded
/*-----------------------------------------------------*/

const MeshLoadingPromise =
    MaterialLoadingPromise.then((materials) => {
        console.log('Materials loaded, now loading FBX models...');

        loader = new FBXLoader();
        const fbxPath = "https://raw.githubusercontent.com/Remi077/miniPlatformGame/main/Ty.fbx";
        // Use an array to store promises for loading multiple FBX files
        // const fbxFiles = ['model1.fbx', 'model2.fbx']; // Replace with your FBX file paths
        const fbxFiles = [fbxPath]; // Replace with your FBX file paths
        const fbxLoadingPromises = fbxFiles.map((file) =>
            new Promise((resolve, reject) => {
                loader.load(
                    file,
                    (object) => {
                        // Set the material to the loaded object if necessary
                        object.traverse((child) => {
                            if (child.isMesh) {
                                // console.log(child.name, child.material);
                                // child.material = materials; // Apply the loaded materials
                                if (child.material) {
                                    // Optional: Replace material with light-independent MeshBasicMaterial
                                    child.material = new THREE.MeshBasicMaterial({
                                        map: child.material.map // Retain the original diffuse map
                                    });
                                }
                            }
                        });

                        // Scale or position the model if needed
                        let charaScale = 0.013;
                        object.scale.set(charaScale, charaScale, charaScale); // Scale down if model is too large
                        object.rotation.set(0, Math.PI / 2, 0);
                        object.position.set(0, -0.5, 0);

                        console.log(`${file} mesh loaded`);
                        chara = object;
                        resolve(object); // Resolve the promise with the loaded object
                    },
                    undefined, // Progress callback
                    (error) => {
                        console.error(`Error loading ${file}:`, error);
                        reject(error); // Reject the promise on error
                    }
                );
            })
        );

        // Wait for all FBX files to load
        return Promise.all(fbxLoadingPromises);
    }).then((loadedFBXObjects) => {
        console.log('All FBX models loaded:', loadedFBXObjects);

        scene.add(chara);
        // mixer = new THREE.AnimationMixer(chara);
        const animPath = "https://raw.githubusercontent.com/Remi077/miniPlatformGame/main/Ty@Running.fbx";

        // Initialize the AnimationMixer with the loaded character
        mixer = new THREE.AnimationMixer(chara);

        // // If the character FBX also contains animations
        // if (character.animations && character.animations.length > 0) {
        //     const action = mixer.clipAction(character.animations[0]); // Play the first animation
        //     action.play();
        // }

        loader.load(animPath, (animationFBX) => {
            // Extract the animation clips from the FBX
            const animationClip = animationFBX.animations[0]; // Assuming the first animation is what you want

            // Add the animation clip to the mixer
            const action = mixer.clipAction(animationClip);
            action.play();
        });


    }).catch((error) => {
        console.error('Error during FBX loading:', error);
    });

/*-----------------------------------------------------*/
// STEP 3
// create SCENE if everything loaded correctly
/*-----------------------------------------------------*/

const sceneCreated =
    MeshLoadingPromise.then(


        // MaterialLoadingPromise.then(
        meshes => {
            const MatDict = matDictV;
            console.log('All objects loaded:', MatDict);


            //city
            let posX = -citySpriteScale;
            for (let i = 0; i < numCitySprites; i++) {
                const citySprite = createSprite(MatDict.CITY, posX, citySpriteDepth, citySpriteHeight, citySpriteScale, 0)
                scene.add(citySprite);
                citySprite.visible = !hideBg;
                citySprites.push(citySprite);
                posX += citySpriteScale;
            }

            const groundGeom = new THREE.BoxGeometry();
            buildMat = MatDict.BUILDING;
            buildHalfMat = MatDict.HALFBUILDING;
            // buildHalfMat = new THREE.MeshBasicMaterial({ color: 0xB8B8B8 });
            let groundMat = buildMat;

            posX = ((groundLength / 2) - 0.1); //small offset
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
            const playerMaterial = MatDict.CRATE;
            player = new THREE.Mesh(playerGeometry, playerMaterial);
            player.visible = false; // Hide the player mesh from the scene
            scene.add(player);
            camera.lookAt(player.position);

            //HUD

            scoreSprite = initializeTextSprite(document, "Score: 0", camera, 0.1, 'black', 'right', 'top', 0.3, 0.2);
            livesSprite = initializeTextSprite(document, "Lives: 3", camera, 0.1, 'black', 'left', 'top', 0.3, 0.2);
            gameOverSprite = initializeTextSprite(document, "Game Over", camera, 0.2, 'Red');
            gameOverSprite.visible = false;

            scene.add(livesSprite);
            scene.add(scoreSprite);
            scene.add(gameOverSprite);

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

sceneCreated.then(() => animate());

/*-----------------------------------------------------*/
// GAMEPLAY FUNCTIONS
/*-----------------------------------------------------*/

// isDead function

function isDead() {
    if (player.position.y <= deathPlaneHeight) {
        console.log("GAMEOVER")
        gameOverSprite.visible = true;
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
    chara.position.y = player.position.y;

}

// updateHUD function

function updateHUD() {
    if (frameCount < 3) {
        liveSpriteInitOffset = alignHUBToCamera(livesSprite, camera, "left", "top", 0.3, 0.2);
        scoreSpriteInitOffset = alignHUBToCamera(scoreSprite, camera, "right", "top", 0.3, 0.2);
        gameOverSpriteInitOffset = alignHUBToCamera(gameOverSprite, camera);
    } else {
        livesSprite.position.copy(camera.position).add(liveSpriteInitOffset);
        scoreSprite.position.copy(camera.position).add(scoreSpriteInitOffset);
        gameOverSprite.position.copy(camera.position).add(gameOverSpriteInitOffset);
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
        updateAnimations(mixer, deltaTime);
    }
    renderer.render(scene, camera);
}

