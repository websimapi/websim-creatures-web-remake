/**
 * Creatures Blueprint - Core Simulation Logic (Redesigned)
 */

export const CHEMICALS = {
    GLUCOSE: 0, PAIN: 1, REWARD: 2, PUNISHMENT: 3, HUNGER: 4, BOREDOM: 5
};

export const ACTIONS = {
    IDLE: 0, MOVE_LEFT: 1, MOVE_RIGHT: 2, EAT: 3, SLEEP: 4, JUMP: 5
};

// Simple AABB Collision
function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

export class Biochemistry {
    constructor() {
        this.chemicals = new Float32Array(10);
        this.chemicals[CHEMICALS.GLUCOSE] = 150;
    }

    tick(dt) {
        // Decay
        this.chemicals[CHEMICALS.GLUCOSE] *= 0.9995;
        this.chemicals[CHEMICALS.REWARD] *= 0.9;
        this.chemicals[CHEMICALS.PUNISHMENT] *= 0.9;
        this.chemicals[CHEMICALS.PAIN] *= 0.9;
        
        // Drives
        this.chemicals[CHEMICALS.HUNGER] = Math.max(0, 200 - this.chemicals[CHEMICALS.GLUCOSE]);
        
        // Clamp
        for(let i=0; i<this.chemicals.length; i++) this.chemicals[i] = Math.max(0, Math.min(255, this.chemicals[i]));
    }
    
    inject(id, amt) {
        this.chemicals[id] = Math.min(255, this.chemicals[id] + amt);
    }
    
    getLevel(id) { return this.chemicals[id]; }
}

export class Brain {
    constructor() {
        // Inputs: 0:NearFood, 1:NearWall, 2:Hunger, 3:Pain, 4:Rand
        // Outputs: ACTIONS
        this.inputSize = 5;
        this.hiddenSize = 6;
        this.outputSize = 6;
        
        this.inputs = new Float32Array(this.inputSize);
        this.hidden = new Float32Array(this.hiddenSize);
        this.outputs = new Float32Array(this.outputSize);
        
        this.wIH = new Float32Array(this.inputSize * this.hiddenSize).map(()=>Math.random()*0.5-0.25);
        this.wHO = new Float32Array(this.hiddenSize * this.outputSize).map(()=>Math.random()*0.5-0.25);
        
        // Instinct: Hunger -> Eat
        // Map Input 2 (Hunger) strongly to Output 3 (Eat)
        // Via hidden 0
        this.wIH[2 * this.hiddenSize + 0] = 1.0;
        this.wHO[0 * this.outputSize + 3] = 1.0;
    }

    tick(senses, bio) {
        // Build inputs
        this.inputs[0] = senses.nearFood ? 1 : 0;
        this.inputs[1] = senses.nearWall ? 1 : 0;
        this.inputs[2] = bio.getLevel(CHEMICALS.HUNGER) / 255;
        this.inputs[3] = bio.getLevel(CHEMICALS.PAIN) / 255;
        this.inputs[4] = Math.random();

        // Feed Forward
        for(let h=0; h<this.hiddenSize; h++) {
            let s=0;
            for(let i=0; i<this.inputSize; i++) s += this.inputs[i] * this.wIH[i*this.hiddenSize + h];
            this.hidden[h] = Math.tanh(s);
        }
        
        let maxOut = -999;
        let action = 0;
        for(let o=0; o<this.outputSize; o++) {
            let s=0;
            for(let h=0; h<this.hiddenSize; h++) s += this.hidden[h] * this.wHO[h*this.outputSize + o];
            this.outputs[o] = Math.tanh(s);
            if (this.outputs[o] > maxOut) { maxOut = this.outputs[o]; action = o; }
        }

        // Learning
        const r = bio.getLevel(CHEMICALS.REWARD);
        const p = bio.getLevel(CHEMICALS.PUNISHMENT);
        let learn = 0;
        if (r > 10) learn = 0.1 * (r/255);
        if (p > 10) learn = -0.1 * (p/255);

        if (Math.abs(learn) > 0.001) {
            for(let h=0; h<this.hiddenSize; h++) {
                for(let i=0; i<this.inputSize; i++) {
                    if (this.inputs[i] > 0.1) this.wIH[i*this.hiddenSize+h] += learn * this.hidden[h];
                }
                for(let o=0; o<this.outputSize; o++) {
                    if (this.hidden[h] > 0.1) this.wHO[h*this.outputSize+o] += learn * this.outputs[o];
                }
            }
        }

        return action;
    }
}

export class World {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.platforms = [
            {x:0, y:h-40, w:w, h:40}, // Floor
            {x:200, y:450, w:200, h:20},
            {x:500, y:350, w:200, h:20},
            {x:900, y:400, w:150, h:20}
        ];
        this.creatures = [];
        this.items = [];
        this.time = 0;
        
        // Spawn
        this.spawnItem('carrot', 300, 420);
        this.spawnItem('ball', 600, 320);
        this.spawnItem('carrot', 950, 370);
    }

    spawnItem(type, x, y) {
        this.items.push({type, x, y, w:30, h:30, active:true});
    }

    addCreature() {
        const c = new Creature(300, 200);
        this.creatures.push(c);
        return c;
    }

    tick(dt) {
        this.time += dt;
        this.creatures.forEach(c => c.tick(this, dt));
        
        // Respawn food occasionaly
        if (this.items.filter(i => i.type==='carrot' && i.active).length < 2 && Math.random() < 0.01) {
            this.spawnItem('carrot', Math.random()*1000 + 100, 100);
        }
    }
}

export class Creature {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 32; // Slightly reduced physics width to match smaller sprite
        this.h = 40; // Slightly reduced physics height
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facing = 1;
        this.state = 'idle';
        
        this.brain = new Brain();
        this.bio = new Biochemistry();
    }

    tick(world, dt) {
        this.bio.tick(dt);
        
        // Physics
        this.vy += 0.6 * dt; // Gravity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Drag
        this.vx *= 0.9;
        
        // Collisions
        this.onGround = false;
        // Check platforms
        for(let p of world.platforms) {
            // Check falling down through top
            if (this.vy > 0 && 
                this.x + this.w/2 > p.x && this.x - this.w/2 < p.x + p.w &&
                this.y >= p.y && (this.y - this.vy*dt) <= p.y) {
                    this.y = p.y;
                    this.vy = 0;
                    this.onGround = true;
            }
        }
        
        // Bounds
        if (this.x < 20) this.x = 20;
        if (this.x > world.width-20) this.x = world.width-20;
        
        // Senses
        const senses = { nearFood: false, nearWall: false };
        let closestFood = null;
        for(let i of world.items) {
            if (i.active && i.type === 'carrot' && Math.abs(i.x - this.x) < 100) {
                senses.nearFood = true;
                if (Math.abs(i.x - this.x) < 40) closestFood = i;
            }
        }
        if (this.x < 50 || this.x > world.width-50) senses.nearWall = true;
        
        // Brain
        const actionIdx = this.brain.tick(senses, this.bio);
        const actionMap = ['idle', 'left', 'right', 'eat', 'sleep', 'jump'];
        const action = actionMap[actionIdx];
        
        // Execute
        const speed = 4;
        if (action === 'left') { this.vx -= 1; if(this.onGround) this.vx = -speed; this.facing = -1; this.state = 'walk'; }
        else if (action === 'right') { this.vx += 1; if(this.onGround) this.vx = speed; this.facing = 1; this.state = 'walk'; }
        else if (action === 'jump' && this.onGround) { this.vy = -12; this.state = 'jump'; this.bio.chemicals[CHEMICALS.GLUCOSE] -= 5; }
        else if (action === 'eat') {
            this.state = 'eat';
            if (closestFood) {
                closestFood.active = false;
                this.bio.inject(CHEMICALS.GLUCOSE, 80);
                this.bio.inject(CHEMICALS.REWARD, 60);
            }
        } else if (action === 'sleep') {
            this.state = 'sleep';
            this.vx *= 0.5;
        } else {
            this.state = 'idle';
        }
    }
}