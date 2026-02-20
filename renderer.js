/**
 * Creatures Renderer - Handles PixiJS
 */
import { Application, Assets, Sprite, Container, Graphics, AnimatedSprite, Texture, Rectangle } from 'pixi.js';

export class GameRenderer {
    constructor(containerId, width, height) {
        this.container = document.getElementById(containerId);
        this.worldWidth = width;
        this.worldHeight = height;
        this.sprites = new Map(); // Map entity object -> Pixi Sprite
        this.textures = {};

        // PixiJS v7 Application
        this.app = new Application({ 
            background: '#1099bb', 
            resizeTo: this.container,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // Enable z-sorting
        this.app.stage.sortableChildren = true;
    }

    async init() {
        this.container.appendChild(this.app.view);
        
        // Load Assets
        await this.loadAssets();
        
        // Setup Layers
        this.rootContainer = new Container();
        this.app.stage.addChild(this.rootContainer);

        this.bgLayer = new Container();
        this.gameLayer = new Container();
        this.uiLayer = new Container();
        
        // Explicit Z-Index to prevent hiding bugs
        this.bgLayer.zIndex = 0;
        this.gameLayer.zIndex = 10;
        this.uiLayer.zIndex = 20;
        
        this.rootContainer.sortableChildren = true;
        this.rootContainer.addChild(this.bgLayer);
        this.rootContainer.addChild(this.gameLayer);
        this.rootContainer.addChild(this.uiLayer);

        // Setup Background
        const bg = new Sprite(this.textures.bg);
        // We will scale this in render/resize
        this.bgLayer.addChild(bg);
        this.bgSprite = bg;
        
        // Create Platform Graphics
        this.platformGraphics = new Graphics();
        this.gameLayer.addChild(this.platformGraphics);
    }

    async loadAssets() {
        // Load textures
        this.textures.bg = await Assets.load('world_bg.png');
        const nornSheet = await Assets.load('norn_sprite.png');
        const itemsSheet = await Assets.load('items.png');

        // Create Norn Animations manually
        // Pixi v7 Texture handling
        const w = nornSheet.width / 4;
        const h = nornSheet.height / 2;
        const nBase = nornSheet.baseTexture;
        
        this.textures.norn = {
            idle: [new Texture(nBase, new Rectangle(0, h, w, h))],
            walk: [
                new Texture(nBase, new Rectangle(0, 0, w, h)),
                new Texture(nBase, new Rectangle(w, 0, w, h)),
                new Texture(nBase, new Rectangle(w*2, 0, w, h)),
                new Texture(nBase, new Rectangle(w*3, 0, w, h))
            ],
            eat: [new Texture(nBase, new Rectangle(w, h, w, h))],
            sleep: [new Texture(nBase, new Rectangle(w*2, h, w, h))]
        };

        // Items
        const iw = itemsSheet.width / 2;
        const ih = itemsSheet.height / 2;
        const iBase = itemsSheet.baseTexture;

        this.textures.items = {
            carrot: new Texture(iBase, new Rectangle(0, 0, iw, ih)),
            computer: new Texture(iBase, new Rectangle(iw, 0, iw, ih)),
            egg: new Texture(iBase, new Rectangle(0, ih, iw, ih)),
            ball: new Texture(iBase, new Rectangle(iw, ih, iw, ih))
        };
    }

    render(world) {
        // 1. Handle Window Resize / Scaling
        // We want the game world height (600) to fit the screen height perfectly
        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;
        const scale = screenH / this.worldHeight;
        
        this.rootContainer.scale.set(scale);

        // 2. Background Handling
        if (this.bgSprite) {
            // Background should cover the whole world width
            // Since root is scaled, we set BG width to worldWidth
            this.bgSprite.width = this.worldWidth;
            this.bgSprite.height = this.worldHeight;
        }

        // 3. Camera Logic
        let targetX = 0;
        if (world.creatures.length > 0) {
            // Focus on creature
            targetX = world.creatures[0].x - (screenW / scale) / 2;
        }
        
        // Clamp camera to world bounds
        const maxScroll = this.worldWidth - (screenW / scale);
        targetX = Math.max(0, Math.min(targetX, maxScroll));
        
        // Apply camera transform
        this.gameLayer.x = -targetX;
        this.bgLayer.x = -targetX * 0.5; // Parallax effect

        // 4. Render Platforms
        this.platformGraphics.clear();
        this.platformGraphics.beginFill(0x2E8B57, 0.8); // SeaGreen, opaque
        // Draw floor
        // this.platformGraphics.drawRect(0, world.height - 60, world.width, 60);
        // Draw platforms
        world.platforms.forEach(p => {
             // Draw rounded rects for platforms
             this.platformGraphics.drawRoundedRect(p.x, p.y, p.w, p.h, 5);
             // Add "moss" or decoration? Keep simple for now
        });
        this.platformGraphics.endFill();

        // Sync Agents
        world.agents.forEach(agent => {
            let sprite = this.sprites.get(agent);
            if (!sprite) {
                sprite = new Sprite(this.textures.items[agent.type]);
                sprite.anchor.set(0.5, 1);
                // Scale is now relative to the 600px height world. 
                // 1.0 means true to pixel art size.
                sprite.scale.set(1.5); 
                this.gameLayer.addChild(sprite);
                this.sprites.set(agent, sprite);
            }
            sprite.x = agent.x;
            sprite.y = agent.y;
            // Handle removal
            if (!agent.active) {
                sprite.destroy();
                this.sprites.delete(agent);
            }
        });

        // Sync Creatures
        world.creatures.forEach(creature => {
            let sprite = this.sprites.get(creature);
            if (!sprite) {
                sprite = new AnimatedSprite(this.textures.norn.idle);
                sprite.anchor.set(0.5, 1);
                sprite.animationSpeed = 0.15;
                sprite.scale.set(2); // Scale up Norn!
                sprite.play();
                this.gameLayer.addChild(sprite);
                this.sprites.set(creature, sprite);
                
                // Add click handler
                sprite.eventMode = 'static';
                sprite.cursor = 'pointer';
                sprite.on('pointerdown', () => {
                    window.dispatchEvent(new CustomEvent('creature-select', { detail: creature }));
                });
            }

            // Update Animation state
            if (creature.currentAnim !== creature.spriteState) {
                creature.currentAnim = creature.spriteState;
                sprite.textures = this.textures.norn[creature.spriteState];
                sprite.play();
            }

            sprite.x = creature.x;
            sprite.y = creature.y;
            // Apply flip while maintaining scale
            sprite.scale.x = creature.direction * 2; 
        });
    }
}