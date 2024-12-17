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


function createSprite(image, posx = 0, posy = 0, posz = 0, scale = 1, rotx = 0, roty = 0, transparent = true) {
    // Create a texture from the image
    const imageTexture = new THREE.Texture(image);
    imageTexture.needsUpdate = true;

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


function createMaterial(image, transparent, side = THREE.DoubleSide, wrapX = 1, wrapY = 1) {
    // Create a texture from the image
    const imageTexture = new THREE.Texture(image);
    imageTexture.needsUpdate = true;
    const imageMaterial = new THREE.MeshBasicMaterial({
        map: imageTexture,
        transparent: transparent,  // Ensure transparency is handled
        side: side, // To show the sprite from both sides if needed
    });
    return imageMaterial;
}


function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        img.onload = () => resolve(img); // Resolve promise when image is loaded
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`)); // Reject promise if there's an error
    });
}




// Function to load all images and create objects based on type and data from JSON
function loadImagesFromDict(imageUrlsDict) {
    const loadPromises = Object.entries(imageUrlsDict).map(([key, data]) => {
        return loadImage(data.url).then(image => {
            // Process each item based on type (sprite or texture)
            if (data.type === 'sprite') {
                const sprite = createSprite(image, , data.scale);
                return [key, sprite]; // Return the sprite
            } else if (data.type === 'texture') {
                const sprite = createSprite(image, data.position, data.scale, 0, 0, );
                // const texture = createTexture(image, data.repeat);
                return [key, texture]; // Return the texture
            }
        });
    });
    // Wait for all images to load and return the results
    return Promise.all(loadPromises).then(results => {
        return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
}


// // Define your dictionary of image URLs
const imageUrlsDict = {
    TREE: 'https://raw.githubusercontent.com/Remi077/mySimpleJSGame/main/tree.png',
    GRASS: 'https://raw.githubusercontent.com/Remi077/mySimpleJSGame/main/grass.png',
};



const imageLoadingPromise = 
fetch('images.json')
    .then(response => response.json()) // Parse JSON
    .then(data => {
        console.log('Loaded JSON data:', data);

        // Use the data (which contains the URL, scale, type, etc.) to load the images and create objects
        return loadImagesFromDict(data);
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });


imageLoadingPromise.then(loadedObjects => {
        console.log('All objects loaded:', loadedObjects);

        // Example: Use the loaded sprites and textures for your scene
        // You can add the sprite or texture to the scene here
        scene.add(loadedObjects.TREE); // Adding the TREE sprite to the scene
        // If using texture for background or ground:
        const groundMaterial = new THREE.MeshBasicMaterial({ map: loadedObjects.GRASS });
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = Math.PI / 2; // Rotate to make it horizontal
        scene.add(ground);
    })






// const imageLoadingPromise = loadImagesFromDict(imageUrlsDict);

// imageLoadingPromise
//     .then(imagesDict  => {
//         console.log('All images are loaded:', imagesDict);

//         // Access images by their keys
//         const treeImage = imagesDict.TREE;
//         const grassImage = imagesDict.GRASS;
        
//         console.log('Tree image:', treeImage);
//         console.log('Grass image:', grassImage);

//         const groundSide = 50; // Size of the ground plane
//         const numberOfTrees = 10; // Number of trees to create
        
//         // Function to generate a random position between 0 and groundSide
//         function getRandomPosition(max) {
//             return Math.random() * max; // Random number between 0 and max
//         }
        
//         createSprite(grassImage, 0, 0, 0, groundSide, Math.PI / 2);

//         // Example: Use the images to create sprites
//         for (let i = 0; i < numberOfTrees; i++) {
//             const x = getRandomPosition(groundSide) - groundSide / 2; // Center the positions around 0
//             const y = getRandomPosition(groundSide) - groundSide / 2;
//             const treeSize = 3;
//             createSprite(treeImage, x, y, treeSize/2, treeSize); // scale set to 3 as an example
//         }
                
//         // Grass Ground (Plane)
//     //     const groundGeometry = new THREE.PlaneGeometry(groundSide, groundSide);
//     //     const groundTexture = new THREE.Texture(grassImage);
//     //     groundTexture.needsUpdate = true;
//     //     // Repeat the texture multiple times
//     //     groundTexture.wrapS = THREE.RepeatWrapping; // Horizontal wrapping
//     //     groundTexture.wrapT = THREE.RepeatWrapping; // Vertical wrapping
//     //     const myrepeat = 15;
//     //     groundTexture.repeat.set(myrepeat, myrepeat); // Number of times to repeat the texture (x, y)
//     // // const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
//     //     const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, side: THREE.DoubleSide });
//     //     const ground = new THREE.Mesh(groundGeometry, groundMaterial);
//     //     ground.rotation.x = Math.PI / 2; // Rotate to make it horizontal
//     //     scene.add(ground);

//     // createSprite(grassImage, 0, 0, groundSide, Math.PI / 2);

//     })
//     .catch(error => {
//         console.error('Error loading images:', error);
//     });

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


// Grass Ground (Plane)
// imageLoadingPromise.then( () =>
//     const groundGeometry = new THREE.PlaneGeometry(50, 50);
//     const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
//     const ground = new THREE.Mesh(groundGeometry, groundMaterial);
//     ground.rotation.x = Math.PI / 2; // Rotate to make it horizontal
//     scene.add(ground);
// );

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    movePlayer();
    // if (isLoaded && tree && grass) {
    // tree.rotation.y += 0.005;
    // }
    renderer.render(scene, camera);
}
imageLoadingPromise.then(() => animate());
