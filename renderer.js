import { Application, Assets, Sprite, Container, Graphics, AnimatedSprite, Texture, Rectangle, BaseTexture } from 'pixi.js';

export class GameRenderer {
    constructor(containerId, worldWidth, worldHeight) {
        this.container = document.getElementById(containerId);
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.sprites = new Map();
        this.textures = {};
        
        // Clean init
        this.app = new Application({
            background: '#1a1a1a',
            resizeTo: window,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1
        });
        this.container.appendChild(this.app.view);
        
        // Layers
        this.stage = this.app.stage;
        this.stage.sortableChildren = true;
        
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.gameLayer = new Container(); this.gameLayer.zIndex = 10;
        this.uiLayer = new Container(); this.uiLayer.zIndex = 20;
        
        this.stage.addChild(this.bgLayer, this.gameLayer, this.uiLayer);
        
        this.platformGfx = new Graphics();
        this.gameLayer.addChild(this.platformGfx);
    }

    async init() {
        // Load
        const bgTex = await Assets.load('world_bg.png');
        const nornTex = await Assets.load('norn_sprite.png');
        const itemsTex = await Assets.load('items.png');

        // Process Textures
        // Norn: Assuming 4 frames walk (top row?), others elsewhere. 
        // Based on previous code: 4x2 grid. 
        // Walk: 0,0 - 1,0 - 2,0 - 3,0. Eat: 1,1. Sleep: 2,1. Idle: 0,1.
        const nw = nornTex.width / 4;
        const nh = nornTex.height / 2;
        
        const crop = (base, x, y, w, h) => new Texture(base, new Rectangle(x*w, y*h, w, h));
        
        this.textures.norn = {
            idle: [crop(nornTex.baseTexture, 0, 1, nw, nh)],
            walk: [
                crop(nornTex.baseTexture, 0, 0, nw, nh),
                crop(nornTex.baseTexture, 1, 0, nw, nh),
                crop(nornTex.baseTexture, 2, 0, nw, nh),
                crop(nornTex.baseTexture, 3, 0, nw, nh)
            ],
            eat: [crop(nornTex.baseTexture, 1, 1, nw, nh)],
            sleep: [crop(nornTex.baseTexture, 2, 1, nw, nh)],
            jump: [crop(nornTex.baseTexture, 3, 1, nw, nh)]
        };

        // Items: 2x2 grid
        const iw = itemsTex.width / 2;
        const ih = itemsTex.height / 2;
        this.textures.items = {
            carrot: crop(itemsTex.baseTexture, 0, 0, iw, ih),
            computer: crop(itemsTex.baseTexture, 1, 0, iw, ih),
            egg: crop(itemsTex.baseTexture, 0, 1, iw, ih),
            ball: crop(itemsTex.baseTexture, 1, 1, iw, ih)
        };

        // Background
        this.bgSprite = new Sprite(bgTex);
        this.bgLayer.addChild(this.bgSprite);
    }

    render(world) {
        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;
        
        // 1. Calculate Scale: Fit World Height to Screen Height
        const scale = screenH / this.worldHeight;
        this.stage.scale.set(scale);
        
        // 2. Camera Logic
        // Find focus point (First creature)
        let camX = 0;
        if(world.creatures[0]) {
            camX = world.creatures[0].x - (screenW / scale / 2);
        }
        
        // Clamp Camera
        const maxCamX = this.worldWidth - (screenW / scale);
        camX = Math.max(0, Math.min(camX, maxCamX));
        
        // Apply Camera
        this.gameLayer.position.x = -camX;
        this.bgLayer.position.x = -camX * 0.5; // Parallax
        
        // Update BG to cover visible area if needed (or just stretch)
        // Here we stretch the BG image to the world size
        this.bgSprite.width = this.worldWidth;
        this.bgSprite.height = this.worldHeight;

        // 3. Render Platforms
        this.platformGfx.clear();
        this.platformGfx.beginFill(0x4a5d23);
        world.platforms.forEach(p => {
            this.platformGfx.drawRoundedRect(p.x, p.y, p.w, p.h, 8);
        });
        this.platformGfx.endFill();

        // 4. Render Items
        world.items.forEach(item => {
            if (!item.active) {
                if(this.sprites.has(item)) {
                    this.sprites.get(item).destroy();
                    this.sprites.delete(item);
                }
                return;
            }
            
            let spr = this.sprites.get(item);
            if (!spr) {
                spr = new Sprite(this.textures.items[item.type]);
                spr.anchor.set(0.5, 1);
                spr.scale.set(1.5); // Item scale
                this.gameLayer.addChild(spr);
                this.sprites.set(item, spr);
            }
            spr.x = item.x;
            spr.y = item.y;
        });

        // 5. Render Creatures
        world.creatures.forEach(c => {
            let spr = this.sprites.get(c);
            if (!spr) {
                spr = new AnimatedSprite(this.textures.norn.idle);
                spr.anchor.set(0.5, 1);
                spr.scale.set(2.0); // Norn scale
                spr.animationSpeed = 0.15;
                spr.play();
                spr.eventMode = 'static'; // Allow clicks
                spr.cursor = 'pointer';
                spr.on('pointerdown', () => window.dispatchEvent(new CustomEvent('creature-select', {detail: c})));
                this.gameLayer.addChild(spr);
                this.sprites.set(c, spr);
            }

            // State switch
            if (c.state !== c._lastState) {
                const anims = this.textures.norn[c.state] || this.textures.norn.idle;
                spr.textures = anims;
                spr.play();
                c._lastState = c.state;
            }

            spr.x = c.x;
            spr.y = c.y;
            spr.scale.x = c.facing * 2.0; // Flip
        });
    }
}