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
    SPEAK: 5
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
        // 4 Hidden
        // 5 Outputs: [Idle, Left, Right, Eat, Sleep]
        
        this.inputSize = 6;
        this.hiddenSize = 8;
        this.outputSize = 5;
        
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
        this.inputs[5] = Math.random(); // Random noise for exploration

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
        const actionMap = [ACTIONS.IDLE, ACTIONS.MOVE_LEFT, ACTIONS.MOVE_RIGHT, ACTIONS.EAT, ACTIONS.SLEEP];
        
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

        // 1. Perception
        const senses = {
            seeFood: false,
            seeToy: false,
            nearWall: false
        };

        // Look around
        const visionRange = 200;
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
        const speed = 2;
        this.state = action;
        this.vx = 0;

        // Energy check
        if (this.biochemistry.getLevel(CHEMICALS.GLUCOSE) < 10 && action !== ACTIONS.SLEEP) {
            this.spriteState = 'sleep'; // Pass out
            return;
        }

        switch(action) {
            case ACTIONS.MOVE_LEFT:
                this.vx = -speed;
                this.direction = -1;
                this.spriteState = 'walk';
                this.x = Math.max(20, this.x + this.vx);
                break;
            case ACTIONS.MOVE_RIGHT:
                this.vx = speed;
                this.direction = 1;
                this.spriteState = 'walk';
                this.x = Math.min(world.width - 20, this.x + this.vx);
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
                break;
            default:
                this.spriteState = 'idle';
                break;
        }
        
        // Burn energy based on movement
        if (Math.abs(this.vx) > 0) {
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
        
        // Initial population
        this.spawnFood();
        this.spawnFood();
        this.agents.push(new Agent('ball', 400, height - 60));
    }

    spawnFood() {
        const x = 50 + Math.random() * (this.width - 100);
        this.agents.push(new Agent('carrot', x, this.height - 60));
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