// import * as THREE from 'three';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

// Dynamically create a canvas element
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Player (Cube)
const playerGeometry = new THREE.BoxGeometry();
playerGeometry.translate(0,0,0);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(player);

/* createSprite */

function createSprite(imageTexture, posx = 0, posy = 0, posz = 0, scale = 1, rotx = 0, roty = 0, transparent = true) {

    // Create a plane geometry for the tree sprite
    const imageGeometry = new THREE.PlaneGeometry(1, 1);  // Adjust size as needed
    const imageMaterial = new THREE.MeshBasicMaterial({
        map: imageTexture,
        transparent: true,  // Ensure transparency is handled
        side: THREE.DoubleSide, // To show the sprite from both sides if needed
    });
    const sprite = new THREE.Mesh(imageGeometry, imageMaterial);

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
function loadMaterialsFromDict(imageUrlsDict) {
    const loadPromises = Object.entries(imageUrlsDict).map(([key, data]) => {
        if (!data || !data.url) {
            console.warn(`Skipping entry with missing 'url' for key: ${key}`);
            return Promise.resolve([key, null]); // Return null for missing or invalid data
        }
        return loadImage(data.url).then(image => {
            const material = createMaterial(image, 
                data.transparent ?? false,
                data.repeat?.x ?? false,
                data.repeat?.y ?? false,
            );
            // const texture = createTexture(image, data.repeat);
            return [key, material]; // Return the texture
        });
    });
    // Wait for all images to load and return the results
    return Promise.all(loadPromises).then(results => {
        return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
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


// STEP 2
// create SCENE if everything loaded correctly
// const sceneCreated =
MaterialLoadingPromise.then(MatDict => {
        console.log('All objects loaded:', MatDict);


        const groundSide = 50; // Size of the ground plane
        const numberOfTrees = 10; // Number of trees to create
        const treeSize = 3;
    
        // Function to generate a random position between 0 and groundSide
        function getRandomPosition(max) {
            return Math.random() * max; // Random number between 0 and max
        }
    
        //ground
        createSprite(MatDict.GRASS, 0, 0, 0, groundSide, Math.PI / 2);

        //trees
        for (let i = 0; i < numberOfTrees; i++) {
            const x = getRandomPosition(groundSide) - groundSide / 2; // Center the positions around 0
            const y = getRandomPosition(groundSide) - groundSide / 2;
            createSprite(MatDict.TREE, x, y, treeSize/2, treeSize); // scale set to 3 as an example
        }
    })


// Set camera position
camera.position.z = 5;
camera.position.y = 5;
camera.lookAt(player.position);

// Movement variables
let moveSpeed = 0.1;
const keys = {};

// Handle keyboard input
document.addEventListener('keydown', (event) => keys[event.key] = true);
document.addEventListener('keyup', (event) => keys[event.key] = false);

function movePlayer() {
    if (keys['ArrowUp']) player.position.z -= moveSpeed;
    if (keys['ArrowDown']) player.position.z += moveSpeed;
    if (keys['ArrowLeft']) player.position.x -= moveSpeed;
    if (keys['ArrowRight']) player.position.x += moveSpeed;
    // camera.lookAt(player.position);
    camera.position.z = player.position.z + 5;
    camera.position.y = player.position.y + 5;
    camera.position.x = player.position.x;
    camera.lookAt(player.position);
        
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    movePlayer();
    renderer.render(scene, camera);
}
MaterialLoadingPromise.then(() => animate());
