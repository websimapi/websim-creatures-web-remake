/**
 * Creatures Blueprint - Core Simulation Logic
 * Covers: Biochemistry, Brain, Genetics, Entities
 */

// --- Constants & Enums ---

export const CHEMICALS = {
    GLUCOSE: 0,
    STARCH: 1,
    FAT: 2,
    PAIN: 3,
    REWARD: 4, // Positive reinforcement
    PUNISHMENT: 5, // Negative reinforcement
    ADRENALINE: 6,
    SLEEPINESS: 7,
    TOXIN: 8,
    // Drives (Mapped from chemicals)
    DRIVE_HUNGER: 9,
    DRIVE_TIREDNESS: 10,
    DRIVE_BOREDOM: 11
};

export const LOBES = {
    PERCEPTION: 0, // Inputs: See Food, See Toy, See Wall
    DRIVE: 1,      // Inputs: Hunger, Pain, Boredom
    CONCEPT: 2,    // Hidden processing
    DECISION: 3,   // Outputs: Eat, Sleep, Move Left, Move Right
    MOTOR: 4       // Actuators
};

export const ACTIONS = {
    IDLE: 0,
    MOVE_LEFT: 1,
    MOVE_RIGHT: 2,
    EAT: 3,
    SLEEP: 4,
    JUMP: 5
};

// --- Biochemistry System ---

export class Biochemistry {
    constructor() {
        this.chemicals = new Float32Array(20); // 20 slots for MVP
        
        // Initial state
        this.chemicals[CHEMICALS.GLUCOSE] = 150;
        this.chemicals[CHEMICALS.STARCH] = 50;
        this.chemicals[CHEMICALS.SLEEPINESS] = 0;
    }

    tick(dt) {
        // 1. Decay (Half-lives)
        // Glucose burns off
        this.chemicals[CHEMICALS.GLUCOSE] *= 0.999; 
        // Pain/Reward decay fast (short term memory/feeling)
        this.chemicals[CHEMICALS.PAIN] *= 0.95;
        this.chemicals[CHEMICALS.REWARD] *= 0.90;
        this.chemicals[CHEMICALS.PUNISHMENT] *= 0.90;
        
        // 2. Accumulation
        // Sleepiness rises slowly
        this.chemicals[CHEMICALS.SLEEPINESS] += 0.05 * dt;

        // 3. Reactions
        // Starch -> Glucose (Digestion)
        if (this.chemicals[CHEMICALS.STARCH] > 0) {
            const transfer = Math.min(this.chemicals[CHEMICALS.STARCH], 0.5 * dt);
            this.chemicals[CHEMICALS.STARCH] -= transfer;
            this.chemicals[CHEMICALS.GLUCOSE] += transfer;
        }

        // 4. Update Drives
        // Hunger is inverse of Glucose
        this.chemicals[CHEMICALS.DRIVE_HUNGER] = Math.max(0, 255 - this.chemicals[CHEMICALS.GLUCOSE]);
        this.chemicals[CHEMICALS.DRIVE_TIREDNESS] = this.chemicals[CHEMICALS.SLEEPINESS];
        
        // Clamp all
        for(let i=0; i<this.chemicals.length; i++) {
            this.chemicals[i] = Math.max(0, Math.min(255, this.chemicals[i]));
        }
    }

    inject(chemicalId, amount) {
        this.chemicals[chemicalId] = Math.min(255, this.chemicals[chemicalId] + amount);
    }
    
    getLevel(chemicalId) {
        return this.chemicals[chemicalId];
    }
}

// --- Neural Network System ---

export class Brain {
    constructor() {
        // Simplified architecture for MVP
        // 6 Inputs: [SeeFood, SeeToy, SeeWall, Hunger, Tiredness, Random]
        // 8 Hidden
        // 6 Outputs: [Idle, Left, Right, Eat, Sleep, Jump]
        
        this.inputSize = 6;
        this.hiddenSize = 8;
        this.outputSize = 6;
        
        this.inputs = new Float32Array(this.inputSize);
        this.hidden = new Float32Array(this.hiddenSize);
        this.outputs = new Float32Array(this.outputSize);
        
        // Weights: Flat arrays
        // Input -> Hidden
        this.weightsIH = new Float32Array(this.inputSize * this.hiddenSize).fill(0).map(() => Math.random() * 0.5 - 0.25);
        // Hidden -> Output
        this.weightsHO = new Float32Array(this.hiddenSize * this.outputSize).fill(0).map(() => Math.random() * 0.5 - 0.25);

        // Pre-wire some instincts (Genetics would do this)
        // Hunger -> Eat (Weak suggestion)
        // Tired -> Sleep
        this.addInstinct(3, 3, 0.5); // Hunger(3) -> Eat(3 via hidden?) - simplifying direct logic for MVP below
    }

    // Helper to set specific weight for instinct
    addInstinct(inputId, outputId, strength) {
        // Hardwire a path through hidden layer 0
        const hIdx = 0;
        this.weightsIH[inputId * this.hiddenSize + hIdx] += strength;
        this.weightsHO[hIdx * this.outputSize + outputId] += strength;
    }

    tick(senses, biochemistry) {
        // 1. Build Inputs
        this.inputs[0] = senses.seeFood ? 1.0 : 0.0;
        this.inputs[1] = senses.seeToy ? 1.0 : 0.0;
        this.inputs[2] = senses.nearWall ? 1.0 : 0.0;
        this.inputs[3] = biochemistry.getLevel(CHEMICALS.DRIVE_HUNGER) / 255;
        this.inputs[4] = biochemistry.getLevel(CHEMICALS.DRIVE_TIREDNESS) / 255;
        // Use the random input as an oscillator or clock to encourage state changes
        this.inputs[5] = Math.sin(Date.now() / 1000); 

        // 2. Feed Forward (Input -> Hidden)
        for(let h=0; h<this.hiddenSize; h++) {
            let sum = 0;
            for(let i=0; i<this.inputSize; i++) {
                sum += this.inputs[i] * this.weightsIH[i * this.hiddenSize + h];
            }
            this.hidden[h] = Math.tanh(sum);
        }

        // 3. Feed Forward (Hidden -> Output)
        for(let o=0; o<this.outputSize; o++) {
            let sum = 0;
            for(let h=0; h<this.hiddenSize; h++) {
                sum += this.hidden[h] * this.weightsHO[h * this.outputSize + o];
            }
            this.outputs[o] = Math.tanh(sum); // -1 to 1
        }

        // 4. Learning (Hebbian / Reinforcement)
        // If Reward chemical is high, strengthen connections that led to current active state
        const reward = biochemistry.getLevel(CHEMICALS.REWARD);
        const punishment = biochemistry.getLevel(CHEMICALS.PUNISHMENT);
        const learnRate = 0.05;

        let signal = 0;
        if (reward > 10) signal = learnRate * (reward/255);
        if (punishment > 10) signal = -learnRate * (punishment/255);

        if (Math.abs(signal) > 0.001) {
            // Update weights based on activity
            for(let h=0; h<this.hiddenSize; h++) {
                for(let i=0; i<this.inputSize; i++) {
                    if (this.inputs[i] > 0.1 && this.hidden[h] > 0.1) {
                        this.weightsIH[i * this.hiddenSize + h] += signal;
                    }
                }
                for(let o=0; o<this.outputSize; o++) {
                    if (this.hidden[h] > 0.1 && this.outputs[o] > 0.1) {
                        this.weightsHO[h * this.outputSize + o] += signal;
                    }
                }
            }
        }

        // 5. Decide Action (Winner takes all)
        let maxVal = -Infinity;
        let action = ACTIONS.IDLE;
        
        // Map output neurons to actions
        const actionMap = [ACTIONS.IDLE, ACTIONS.MOVE_LEFT, ACTIONS.MOVE_RIGHT, ACTIONS.EAT, ACTIONS.SLEEP, ACTIONS.JUMP];
        
        for(let i=0; i<this.outputSize; i++) {
            if (this.outputs[i] > maxVal) {
                maxVal = this.outputs[i];
                action = actionMap[i];
            }
        }
        
        return action;
    }
}

// --- Entities ---

export class Agent {
    constructor(type, x, y) {
        this.type = type; // 'carrot', 'ball', 'egg'
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.active = true;
    }
}

export class Creature {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.width = 40;
        this.height = 50;
        
        this.biochemistry = new Biochemistry();
        this.brain = new Brain();
        
        this.state = ACTIONS.IDLE;
        this.age = 0;
        this.direction = 1; // 1 right, -1 left
        
        this.spriteState = 'idle'; // for renderer
    }

    tick(world, dt) {
        this.age += dt;
        this.biochemistry.tick(dt);

        // Physics: Gravity
        this.vy += 0.5 * dt;
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        
        this.onGround = false;

        // Platform Collision (One-way: only land if falling)
        if (this.vy >= 0) {
            // Check world platforms
            for (const p of world.platforms) {
                // Check X bounds (with small margin for sprite width)
                if (this.x > p.x - 10 && this.x < p.x + p.w + 10) {
                    // Check Y bounds: Only collide if feet passed through top of platform
                    // Previous Y = this.y - this.vy * dt
                    // Current Y = this.y
                    const prevY = this.y - this.vy * dt;
                    if (prevY <= p.y && this.y >= p.y) {
                        this.y = p.y;
                        this.vy = 0;
                        this.onGround = true;
                        break;
                    }
                }
            }
        }

        // Ground Collision (Simple floor at world height - 60)
        const groundLevel = world.height - 60;
        if (!this.onGround && this.y > groundLevel) {
            this.y = groundLevel;
            this.vy = 0;
            this.onGround = true;
        }

        // Friction
        if (this.onGround) {
            this.vx *= 0.8;
        } else {
            this.vx *= 0.95; // Air resistance
        }

        // 1. Perception
        const senses = {
            seeFood: false,
            seeToy: false,
            nearWall: false,
            onGround: this.onGround // Let the brain know if we can jump
        };

        // Look around
        const visionRange = 250;
        let nearestFood = null;

        world.agents.forEach(agent => {
            if (!agent.active) return;
            const dist = Math.abs(agent.x - this.x);
            if (dist < visionRange) {
                if (agent.type === 'carrot') {
                    senses.seeFood = true;
                    if (dist < 40) nearestFood = agent;
                }
                if (agent.type === 'ball') senses.seeToy = true;
            }
        });
        
        if (this.x < 50 || this.x > world.width - 50) senses.nearWall = true;

        // 2. Think
        const desiredAction = this.brain.tick(senses, this.biochemistry);

        // 3. Act
        this.executeAction(desiredAction, nearestFood, world, dt);
    }

    executeAction(action, targetObject, world, dt) {
        const speed = 5; // Faster for platforming feel
        this.state = action;

        // Energy check
        if (this.biochemistry.getLevel(CHEMICALS.GLUCOSE) < 10 && action !== ACTIONS.SLEEP) {
            this.spriteState = 'sleep'; // Pass out
            return;
        }

        switch(action) {
            case ACTIONS.MOVE_LEFT:
                if (this.onGround) {
                    this.vx = -speed;
                    this.spriteState = 'walk';
                }
                this.direction = -1;
                break;
            case ACTIONS.MOVE_RIGHT:
                if (this.onGround) {
                    this.vx = speed;
                    this.spriteState = 'walk';
                }
                this.direction = 1;
                break;
            case ACTIONS.JUMP:
                if (this.onGround) {
                    this.vy = -12; // Jump impulse
                    this.onGround = false;
                    this.spriteState = 'walk'; // Reuse walk for jump for now
                    // Jumping costs energy
                    this.biochemistry.chemicals[CHEMICALS.GLUCOSE] -= 2;
                }
                break;
            case ACTIONS.EAT:
                if (targetObject && targetObject.type === 'carrot') {
                    this.spriteState = 'eat';
                    // Consume logic
                    targetObject.active = false; // Poof
                    this.biochemistry.inject(CHEMICALS.GLUCOSE, 100);
                    this.biochemistry.inject(CHEMICALS.REWARD, 50); // Yummy
                    // Respawn food elsewhere after delay? Handled by World
                    setTimeout(() => world.spawnFood(), 5000);
                } else {
                    this.spriteState = 'idle'; // Tried to eat nothing
                }
                break;
            case ACTIONS.SLEEP:
                this.spriteState = 'sleep';
                this.biochemistry.chemicals[CHEMICALS.SLEEPINESS] *= 0.9; // Reduce sleepiness
                this.vx *= 0.5; // Slow down faster
                break;
            default:
                // Idle
                if (this.onGround && Math.abs(this.vx) < 0.1) {
                    this.spriteState = 'idle';
                }
                break;
        }
        
        // Boundaries
        if (this.x < 20) { this.x = 20; this.vx = 0; }
        if (this.x > world.width - 20) { this.x = world.width - 20; this.vx = 0; }

        // Burn energy based on movement
        if (Math.abs(this.vx) > 1) {
            this.biochemistry.chemicals[CHEMICALS.GLUCOSE] -= 0.1 * dt;
        }
    }
}

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.creatures = [];
        this.agents = [];
        this.platforms = [];
        
        // Create Environment
        this.generatePlatforms();
        
        // Initial population
        this.spawnFood();
        this.spawnFood();
        this.spawnToy();
    }

    generatePlatforms() {
        // Main ground is handled by collision logic, but let's add some floating structures
        // Format: { x, y, w, h }
        this.platforms.push({ x: 300, y: 450, w: 200, h: 20 }); // Low left
        this.platforms.push({ x: 600, y: 350, w: 200, h: 20 }); // Mid
        this.platforms.push({ x: 900, y: 450, w: 200, h: 20 }); // Low right
        this.platforms.push({ x: 1200, y: 300, w: 300, h: 20 }); // High shelf
    }

    spawnFood() {
        // Try to spawn on platforms or ground
        let x = 50 + Math.random() * (this.width - 100);
        let y = this.height - 60;
        
        // 30% chance to spawn on a platform
        if (Math.random() < 0.3 && this.platforms.length > 0) {
            const p = this.platforms[Math.floor(Math.random() * this.platforms.length)];
            x = p.x + Math.random() * p.w;
            y = p.y;
        }

        this.agents.push(new Agent('carrot', x, y));
    }

    spawnToy() {
        // Spawn a computer or ball
        const type = Math.random() > 0.5 ? 'ball' : 'computer';
        this.agents.push(new Agent(type, 800, this.height - 60));
    }

    addCreature() {
        const c = new Creature(this.width / 2, this.height - 70);
        this.creatures.push(c);
        return c;
    }

    tick(dt) {
        this.creatures.forEach(c => c.tick(this, dt));
        // Cleanup inactive agents
        this.agents = this.agents.filter(a => a.active);
    }
}