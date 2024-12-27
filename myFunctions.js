// myFunctions.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { FBXLoader } from './FBXLoader.js'

//TEXT SPRITE

export function alignHUBToCamera(sprite, thisCamera, alignX = 'center', alignY = 'middle', padx = 0, pady = 0) {

    //check camera is defined
    if (thisCamera == null)
        console.error('thisCamera is not defined');

    let posX, posY;
    switch (alignX) {
        case "center": posX = 0; break;
        case "left": posX = -1 + padx; break;
        case "right": posX = 1 - padx; break;
        default: posX = 0;
    }
    switch (alignY) {
        case "middle": posY = 0; break;
        case "bottom": posY = -1 + pady; break;
        case "top": posY = 1 - pady; break;
        default: posY = 0;
    }

    const vector = new THREE.Vector3(
        posX,
        posY,
        -1 // Depth in NDC (-1 is near the camera)
    );

    // Unproject the screen position to world coordinates
    vector.unproject(thisCamera);

    // Ensure the sprite stays in view
    sprite.position.copy(vector);

    // Calculate the offset vector 
    var offsetVector = new THREE.Vector3().subVectors(sprite.position, thisCamera.position);
    return (offsetVector);//return offset
}

export function initializeTextSprite(thisDocument, text, thisCamera, scale = 10, color = 'black', alignX, alignY, padX, padY) {
    const textCanvas = thisDocument.createElement('canvas');
    const context = textCanvas.getContext('2d');
    textCanvas.width = 256;
    textCanvas.height = 128;

    context.fillStyle = color;
    context.font = '30px Arial';
    context.textAlign = 'center';
    context.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    const texture = new THREE.CanvasTexture(textCanvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false // Disable depth test (never occluded)
    });
    const sprite = new THREE.Sprite(material);
    // sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(1 * scale, 0.5 * scale, 1);  // Adjust the scale as needed

    alignHUBToCamera(sprite, thisCamera, alignX, alignY, padX, padY);

    sprite.textCanvas = textCanvas;
    sprite.context = context;
    sprite.texture = texture;

    return sprite;
}

/* createSprite */

export function createSprite(imageMat, posx = 0, posy = 0, posz = 0, scale = 1, rotx = 0, roty = 0, transparent = true) {

    // Create a plane geometry for the tree sprite
    const imageGeometry = new THREE.PlaneGeometry(1, 1);  // Adjust size as needed
    const sprite = new THREE.Mesh(imageGeometry, imageMat);

    sprite.position.set(posx, posz, posy);  // Set the position of the tree sprite in the scene
    sprite.rotation.x = rotx;
    sprite.rotation.y = roty;
    sprite.scale.set(scale, scale, scale);

    // scene.add(sprite);

    return sprite;
};

/* createMaterial */

export function createMaterial(image, transparent = false, wrapX = 1, wrapY = 1) {
    // Create a texture from the image
    const imageTexture = new THREE.Texture(image);
    imageTexture.needsUpdate = true;
    // Repeat the texture multiple times
    imageTexture.wrapS = THREE.RepeatWrapping; // alignXizontal wrapping
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

export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        img.onload = () => resolve(img); // Resolve promise when image is loaded
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`)); // Reject promise if there's an error
    });
}

/* updateAnimations */
export function updateAnimations(thisMixer, delta) {
    // Update the mixer (animation playback)
    if (thisMixer) {
        thisMixer.update(delta);
    } else {
        console.error("no mixer found")
    }
}

/* load resources from JSON and place them in a dictionary */
export function loadResourcesFromJson(jsonPath) {
    return fetch(jsonPath)
        .then(response => response.json()) // Parse JSON
        .then(jsonData => {
            console.log('Loaded JSON data:', jsonData);
            // Use the data (which contains the URL, scale, type, etc.) 
            // to load the resources and create objects.
            // return all resources in a dictionary
            const result = loadResources(jsonData);
            console.log('Parsed JSON data');
            return result;
        }).catch(error => {
            console.error('Error loading JSON:', error);
            throw error; // Re-throw the error for upstream handling
        });
}

/* load resources from JSON Data*/
export function loadResources(jsonData) {
    const loadPromises = Object.entries(jsonData).map(([key, data]) => {
        if (key == "IMAGES") {
            //load images
            return loadImages(data).then(result => [key, result]);
        } else if (key == "MESHES") {
            //load meshes
            return loadMeshes(data).then(result => [key, result]);
        } else {
            console.warn(`key entry: ${key} is not supported`);
            return Promise.resolve([key, null]); // Return null for missing or invalid data
        }
    });
    return Promise.all(loadPromises).then(results => {
        return Object.fromEntries(results); // Convert back to a dictionary
    });
}

/* loadImages */
// Function to load all images and create objects based on type and data from JSON
export function loadImages(jsonData) {
    const loadPromises = Object.entries(jsonData).map(([key, data]) => {
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
        return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
}

/* loadMeshes */
// Function to load all meshes and create objects based on type and data from JSON
export function loadMeshes(jsonData) {
    const loader = new FBXLoader();
    const loadPromises = Object.entries(jsonData).map(([key, data]) => {
        if (!data || !data.url) {
            console.warn(`Skipping entry with missing 'url' for key: ${key}`);
            return Promise.resolve([key, null]); // Return null for missing or invalid data
        }
        return loadMesh(loader, data.url, data.lit, data.animations).then(result => {
            return [key, result]; // Return the mesh
        });
    });
    // Wait for all images to load and return the results
    return Promise.all(loadPromises).then(results => {
        return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
}

/* loadMesh */
export function loadMesh(loader, src, lit = false, animations = null) {
    return new Promise((resolve, reject) => {
        loader.load(
            src,
            (object) => {
                // Set the material to the loaded object if necessary
                object.traverse((child) => {
                    if (child.isMesh) {
                        if (child.material && !lit) {
                            // Optional: Replace material with light-independent MeshBasicMaterial
                            child.material = new THREE.MeshBasicMaterial({
                                map: child.material.map // Retain the original diffuse map
                            });
                        }
                    }
                });
                console.log(`${src} mesh loaded`);
                resolve(object); // Resolve the promise with the loaded object
            },
            undefined, // Progress callback
            (error) => {
                console.error(`Error loading ${src}:`, error);
                reject(error); // Reject the promise on error
            }
        );
    }).then((mesh) => {

        if (animations) {
            const mixer = new THREE.AnimationMixer(mesh);
            // Assuming loadAnimations returns a Promise
            return loadAnimations(loader, mixer, animations).then(
                (loadedAnimations) => {

                    // Create the result object with both the mesh and animations
                    const result = {
                        MESH: mesh,
                        MIXER: mixer,
                        ANIMATIONS: loadedAnimations
                    };

                    return result; // Return the result with both MESH and ANIMATIONS
                });
        } else {

            const result = {
                MESH: mesh
            };

            return result; // Return the result with MESH but no ANIMATION 
        }
    });
}


/* loadAnimations */
export function loadAnimations(loader, mixer, animations) {
    const loadPromises = Object.entries(animations).map(([key, data]) => {
        if (!data || !data.url) {
            console.warn(`Skipping entry with missing 'url' for key: ${key}`);
            return Promise.resolve([key, null]); // Return null for missing or invalid data
        }
        return loadAnimation(loader, mixer, data.url).then(result => {
            return [key, result]; // Return the mesh
        });
    });
    // Wait for all images to load and return the results
    return Promise.all(loadPromises).then(results => {
        return Object.fromEntries(results); // Convert back to a dictionary { key: sprite/texture }
    });
}

/* loadAnimation */
export function loadAnimation(loader, mixer, src) {
    return new Promise((resolve, reject) => {
        loader.load(
            src,
            (animationFBX) => {
                console.log(`${src} animation loaded`);
                // Extract the animation clips from the FBX
                const animationClip = animationFBX.animations[0]; // Assuming the first animation is what you want
                // Add the animation clip to the mixer
                const action = mixer.clipAction(animationClip);

                // action.play();
                resolve(action); // Resolve the promise with the loaded object
            },
            undefined, // Progress callback
            (error) => {
                console.error(`Error loading ${src}:`, error);
                reject(error); // Reject the promise on error
            }
        );
    })
}

export function updateTextSprite(sprite, newText, color = 'Red') {
    const { textCanvas, context, texture } = sprite;
    console.log("textCanvas, context, texture", textCanvas, context, texture);

    // Clear the canvas
    context.clearRect(0, 0, textCanvas.width, textCanvas.height);

    // Redraw the text
    context.fillStyle = color;
    context.font = '30px Arial';
    context.textAlign = 'center';
    context.fillText(newText, textCanvas.width / 2, textCanvas.height / 2);

    // Refresh the texture
    texture.needsUpdate = true;
}
