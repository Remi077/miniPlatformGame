        // Import Three.js
        // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
        import * as THREE from 'three';

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
        const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const player = new THREE.Mesh(playerGeometry, playerMaterial);
        scene.add(player);

        // Ground (Plane)
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = Math.PI / 2; // Rotate to make it horizontal
        scene.add(ground);

        // Load tree image and create a texture
        const treeImage = new Image();
        treeImage.src = 'https://raw.githubusercontent.com/Remi077/mySimpleJSGame/main/tree.png';
        treeImage.crossOrigin = 'Anonymous';  // This is important for cross-origin images

        treeImage.onload = () => {
            console.log("Image loaded:", treeImage);

            // Create a texture from the image
            const treeTexture = new THREE.Texture(treeImage);
            treeTexture.needsUpdate = true;

            // Create a plane geometry for the tree sprite
            const treeGeometry = new THREE.PlaneGeometry(1, 1);  // Adjust size as needed
            const treeMaterial = new THREE.MeshBasicMaterial({
                map: treeTexture,
                transparent: true,  // Ensure transparency is handled
                side: THREE.DoubleSide, // To show the sprite from both sides if needed
            });
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.set(0, 0.5, -2);  // Set the position of the tree sprite in the scene
            scene.add(tree);
        };

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
        }

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            movePlayer();
            renderer.render(scene, camera);
        }
        animate();