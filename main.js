// import * as THREE from 'three';
import * as THREE    from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
// import * as FBX from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/FBXLoader.js';
import { FBXLoader } from './FBXLoader.js'


import seedrandom from 'https://cdn.skypack.dev/seedrandom';

// Example revision hash
const revision = "1.03"; // Replace with actual Git hash

// Add it to the div
document.getElementById('revision-info').innerText = `Version: ${revision}`;

// pseudoseed
const rng = seedrandom('666'); // Create a seeded random generator

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
// Usage
if (isMobile()) {
    console.log("You're on a mobile device!");
} else {
    console.log("You're on a desktop!");
}


// Movement variables
const numPlat = 8
const numPlatToTheLeft = 4
const groundLength = 6;
const groundGap = 2;
const moveSpeed = 0.1;
const groundSpeed = isMobile() ? 0.15/1.5 : 0.15;
// const groundSpeed = 0;
const groundInitPos = (numPlat-numPlatToTheLeft) * (groundLength + groundGap);
const groundLimit = -numPlatToTheLeft * (groundLength + groundGap);
const jumpInitVerticalSpeed = 0.3;
const gravitySpeedDecrement = isMobile() ? 0.015 : 0.02;
const groundMinY = -1.5;
const groundMaxY = 1.5;
const groundLengthRatioMin = 0.35;
const groundLengthRatioMax = 1;
const groundHeight = 30;
const groundCenterY = -0.5-(groundHeight/2);

// camera offset position
const cameraOffsetZ = 15;
// const cameraOffsetZ = 150;
const cameraOffsetY = 2;

//background
const numCitySprites = 4;
const numCitySpritesToTheLeft = 1;
const citySpriteScale = 50;
const citySpriteDepth = -5;
const citySpriteHeight = -8;
const bgSpeed = groundSpeed*0.75;
// const bgSpeed = 0.15*0.75;
const bgLimit = -(numCitySpritesToTheLeft+1)*citySpriteScale;
const bgInitPos = (numCitySprites-numCitySpritesToTheLeft-1)*citySpriteScale;




// Dynamically create a canvas element
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let player;


/* createSprite */

function createSprite(imageMat, posx = 0, posy = 0, posz = 0, scale = 1, rotx = 0, roty = 0, transparent = true) {

    // Create a plane geometry for the tree sprite
    const imageGeometry = new THREE.PlaneGeometry(1, 1);  // Adjust size as needed
    const sprite = new THREE.Mesh(imageGeometry, imageMat);

    sprite.position.set(posx, posz, posy);  // Set the position of the tree sprite in the scene
    sprite.rotation.x = rotx; 
    sprite.rotation.y = roty; 
    sprite.scale.set(scale, scale, scale);

    scene.add(sprite);

    return sprite;
};

/* createMaterial */

function createMaterial(image, transparent = false, wrapX = 1, wrapY = 1) {
    // Create a texture from the image
    const imageTexture = new THREE.Texture(image);
    imageTexture.needsUpdate = true;
    // Repeat the texture multiple times
    imageTexture.wrapS = THREE.RepeatWrapping; // Horizontal wrapping
    imageTexture.wrapT = THREE.RepeatWrapping; // Vertical wrapping
    imageTexture.repeat.set(wrapX, wrapY); // Number of times to repeat the texture (x, y)

    const imageMaterial = new THREE.MeshBasicMaterial({
        map: imageTexture,
        transparent: transparent,  // Ensure transparency is handled
        side: THREE.DoubleSide, // To show the sprite from both sides if needed
    });

    return imageMaterial;
}


/* loadImage */

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        img.onload = () => resolve(img); // Resolve promise when image is loaded
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`)); // Reject promise if there's an error
    });
}

/* loadImagesFromDict */
// Function to load all images and create objects based on type and data from JSON
let matDictV = {};
function loadMaterialsFromDict(imageUrlsDict) {
    const loadPromises = Object.entries(imageUrlsDict).map(([key, data]) => {
        if (!data || !data.url) {
            console.warn(`Skipping entry with missing 'url' for key: ${key}`);
            return Promise.resolve([key, null]); // Return null for missing or invalid data
        }
        return loadImage(data.url).then(image => {
            const material = createMaterial(image, 
                data.transparent ?? false,
                data.repeat?.x ?? 1,
                data.repeat?.y ?? 1,
            );
            return [key, material]; // Return the texture
        });
    });
    // Wait for all images to load and return the results
    return Promise.all(loadPromises).then(results => {
        matDictV = Object.fromEntries(results);
        return matDictV;
        // return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
}

// Function to generate a random position between min and max using rng()
function getRandom(min, max) {
    return rng() * (max - min) + min; // Random number between min and max
}


// STEP 1
// fetch JSON and populate material dictionary
const MaterialLoadingPromise = 
fetch('images.json')
    .then(response => response.json()) // Parse JSON
    .then(data => {
        console.log('Loaded JSON data:', data);

        // Use the data (which contains the URL, scale, type, etc.) to load the images and create objects
        return loadMaterialsFromDict(data);
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });

// // Add an Ambient Light (provides even lighting across the scene)
// const ambientLight = new THREE.AmbientLight(0xffffff, 5); // Color: white, Intensity: 0.5
// scene.add(ambientLight);


// STEP 2
// Load FBXs after materials are loaded
let chara;
// Initialize the loader
let loader;
let mixer;
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
                            console.log(child.name, child.material);
                            // child.material = materials; // Apply the loaded materials
                            if (child.material){
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
                    object.rotation.set(0, Math.PI/2, 0);
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

    // Add loaded objects to the scene or perform additional processing
    // loadedFBXObjects.forEach((fbx) => {
    //     scene.add(fbx); // Assuming `scene` is your THREE.Scene instance
    // });
    scene.add(chara);
    mixer =  new THREE.AnimationMixer(chara);
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



// STEP 3
// create SCENE if everything loaded correctly
let grounds = [];
let citySprites = [];
const sceneCreated =
MeshLoadingPromise.then(

    
    // MaterialLoadingPromise.then(
    meshes => {
        const MatDict = matDictV;
        console.log('All objects loaded:', MatDict);


        //city
        let posX = -citySpriteScale;
        for (let i = 0; i < numCitySprites; i++) {
            citySprites.push(createSprite(MatDict.CITY, posX, citySpriteDepth, citySpriteHeight, citySpriteScale, 0));
            posX += citySpriteScale;
        }

        const groundGeom = new THREE.BoxGeometry();
        // const groundMat = new THREE.MeshBasicMaterial({ color: 0xB8B8B8 });
        const groundMat = MatDict.BUILDING;
        
        posX = (groundLength/2);
        let curScaleX = groundLength
        for (let i = 0; i < numPlat; i++) {
            curScaleX = (i!=0) ? (groundLength * getRandom(groundLengthRatioMin,groundLengthRatioMax)): groundLength;
            const ground = new THREE.Mesh(groundGeom, groundMat);
            ground.scale.set(curScaleX, groundHeight, curScaleX);
            ground.position.set(posX, 
                (i!=0) ? (groundCenterY + getRandom(groundMinY, groundMaxY)) : groundCenterY, 
                0);
            posX += groundLength + groundGap
            scene.add(ground);
            grounds.push(ground);
        }

        //player
        const playerGeometry = new THREE.BoxGeometry();
        playerGeometry.translate(0,0.5,0);
        const playerMaterial = MatDict.CRATE;
        player = new THREE.Mesh(playerGeometry, playerMaterial);
        player.visible = false; // Hide the player mesh from the scene
        scene.add(player);

    })




    let nextColIdx = 0;
    function isCollidingGrounds() {
        let result = null;
        let numCalculations = 0;
        for (let i = 0; i < 2; i++) { //only check current and next platform
            let idx = (i+nextColIdx) % numPlat;//start from current platform
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

// const cameraOffsetY = 5;
camera.position.z = cameraOffsetZ;
camera.position.y = cameraOffsetY;
sceneCreated.then(() => camera.lookAt(player.position));


const keys = {};
let tapped = false;
// Handle keyboard input
document.addEventListener('keydown', (event) => keys[event.code] = true);
document.addEventListener('keyup', (event) => keys[event.code] = false);
document.addEventListener('touchstart', jump);//tapped = true);

let playerVerticalSpeed = 0;
let isTouchingGround = null;
let hasJumped = false;
let keyAPressed = false;
function jump(){
    if (isTouchingGround != null && !hasJumped) {
        console.log('JUMP');
        playerVerticalSpeed += jumpInitVerticalSpeed; 
        hasJumped = true;
    }
}
function movePlayer() {
    if (keys['ArrowUp']) player.position.y += moveSpeed;
    if (keys['ArrowDown']) player.position.y -= moveSpeed;
    if (keys['Space'] ){
        jump();
    } else {
        hasJumped = false;
    }
    // if (tapped){
    //     console.log('tapped');
    //     jump();
    // }
    if (keys['KeyA']
        || true
    ) {
        if (!keyAPressed){
            player.position.y += playerVerticalSpeed;
            isTouchingGround = isCollidingGrounds();
            if (isTouchingGround == null) {
                playerVerticalSpeed -= gravitySpeedDecrement;
            } else {
                player.position.y =  isTouchingGround; // Calculate top height
                playerVerticalSpeed = 0;
            }
            // console.log('playerVerticalSpeed',playerVerticalSpeed);
            // console.log('player.position.y',player.position.y);
            // console.log('isTouchingGround',isTouchingGround);
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

function moveGrounds() {
    grounds.forEach(ground => moveGround(ground));
}

function moveGround(thisGround) {
    thisGround.position.x -= groundSpeed;
    if (thisGround.position.x < groundLimit) {
        let curScaleX = groundLength * getRandom(groundLengthRatioMin,groundLengthRatioMax);
        thisGround.position.x = groundInitPos;
        thisGround.scale.set(curScaleX, groundHeight, curScaleX);
        thisGround.position.y = groundCenterY+getRandom(groundMinY, groundMaxY)
    }

}

let citySpriteLeftIdx = 0;
function moveBG() {
    let leftSpritePosX = citySprites[citySpriteLeftIdx].position.x - bgSpeed;
    let posX = leftSpritePosX;
    for (let i = 0; i < numCitySprites; i++) {
        let idx = (citySpriteLeftIdx + i)%numCitySprites;
        let sprite = citySprites[idx];
        sprite.position.x = posX;
        posX += citySpriteScale;
    };
    if (leftSpritePosX < bgLimit) {
        citySpriteLeftIdx = (citySpriteLeftIdx + 1)%numCitySprites;
    }
}

const clock = new THREE.Clock();
function updateAnimations(){
    // Update the mixer (animation playback)
    if (mixer) {
        const delta = clock.getDelta(); // Time elapsed since last frame
        mixer.update(delta);
    } else {
        console.error("no mixer found")
    }
}

// let frameCount = 0;
// Animation loop
function animate() {
    // console.log('frame',frameCount++)
    requestAnimationFrame(animate);
    movePlayer();
    moveGrounds();
    moveBG();
    updateAnimations();
    renderer.render(scene, camera);
}
sceneCreated.then(() => animate());
