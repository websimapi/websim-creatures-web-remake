/**
 * Creatures Renderer - Handles PixiJS
 */
import { Application, Assets, Sprite, Container, Graphics, AnimatedSprite, Texture, Rectangle } from 'pixi.js';

export class GameRenderer {
    constructor(containerId, width, height) {
        this.app = new Application();
        this.container = document.getElementById(containerId);
        this.worldWidth = width;
        this.worldHeight = height;
        this.sprites = new Map(); // Map entity object -> Pixi Sprite
        
        this.textures = {};
    }

    async init() {
        await this.app.init({ 
            background: '#1099bb', 
            resizeTo: this.container,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        this.container.appendChild(this.app.canvas);
        
        // Load Assets
        await this.loadAssets();
        
        // Setup Layers
        this.bgLayer = new Container();
        this.gameLayer = new Container();
        this.uiLayer = new Container();
        
        this.app.stage.addChild(this.bgLayer);
        this.app.stage.addChild(this.gameLayer);
        this.app.stage.addChild(this.uiLayer);

        // Setup Background
        const bg = new Sprite(this.textures.bg);
        bg.width = this.worldWidth;
        bg.height = this.app.screen.height; // Stretch to screen height for MVP
        this.bgLayer.addChild(bg);
        this.bgSprite = bg;
    }

    async loadAssets() {
        // Load textures
        this.textures.bg = await Assets.load('world_bg.png');
        const nornSheet = await Assets.load('norn_sprite.png');
        const itemsSheet = await Assets.load('items.png');

        // Create Norn Animations manually since we don't have a JSON atlas
        // Assuming sprite sheet is grid. 
        // Let's assume norn_sprite is 4x2 grid (4 walk, 1 eat, 1 sleep, 1 stand, 1 unused)
        const w = nornSheet.width / 4;
        const h = nornSheet.height / 2;
        
        this.textures.norn = {
            idle: [new Texture({ source: nornSheet.source, frame: new Rectangle(0, h, w, h) })],
            walk: [
                new Texture({ source: nornSheet.source, frame: new Rectangle(0, 0, w, h) }),
                new Texture({ source: nornSheet.source, frame: new Rectangle(w, 0, w, h) }),
                new Texture({ source: nornSheet.source, frame: new Rectangle(w*2, 0, w, h) }),
                new Texture({ source: nornSheet.source, frame: new Rectangle(w*3, 0, w, h) })
            ],
            eat: [new Texture({ source: nornSheet.source, frame: new Rectangle(w, h, w, h) })],
            sleep: [new Texture({ source: nornSheet.source, frame: new Rectangle(w*2, h, w, h) })]
        };

        // Items
        const iw = itemsSheet.width / 2;
        const ih = itemsSheet.height / 2;
        this.textures.items = {
            carrot: new Texture({ source: itemsSheet.source, frame: new Rectangle(0, 0, iw, ih) }),
            computer: new Texture({ source: itemsSheet.source, frame: new Rectangle(iw, 0, iw, ih) }),
            egg: new Texture({ source: itemsSheet.source, frame: new Rectangle(0, ih, iw, ih) }),
            ball: new Texture({ source: itemsSheet.source, frame: new Rectangle(iw, ih, iw, ih) })
        };
    }

    render(world) {
        // Ensure BG fits screen
        if (this.bgSprite) {
            this.bgSprite.width = this.worldWidth;
            this.bgSprite.height = this.app.screen.height;
        }

        // Center camera on creatures (simple logic)
        // In a real game, smooth damping
        let targetX = 0;
        if (world.creatures.length > 0) {
            targetX = world.creatures[0].x - this.app.screen.width / 2;
        }
        // Clamp camera
        targetX = Math.max(0, Math.min(targetX, this.worldWidth - this.app.screen.width));
        
        this.gameLayer.x = -targetX;
        this.bgLayer.x = -targetX * 0.5; // Parallax

        // Sync Agents
        world.agents.forEach(agent => {
            let sprite = this.sprites.get(agent);
            if (!sprite) {
                sprite = new Sprite(this.textures.items[agent.type]);
                sprite.anchor.set(0.5, 1);
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
            sprite.scale.x = creature.direction; // Flip
        });
    }
}