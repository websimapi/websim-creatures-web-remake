import { World, CHEMICALS } from './simulation.js';
import { GameRenderer } from './renderer.js';

// --- Game Bootstrap ---

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 600;

const world = new World(WORLD_WIDTH, WORLD_HEIGHT);
const renderer = new GameRenderer('game-container', WORLD_WIDTH, WORLD_HEIGHT);

let selectedCreature = null;
let lastTime = performance.now();

// --- Initialization ---

async function start() {
    await renderer.init();
    
    // Hatch first norn
    const norn = world.addCreature();
    // Move norn to start position
    norn.x = 250;
    norn.y = 300; // Drop from sky
    
    selectedCreature = norn;
    updateUISelection();

    // Reset time to prevent huge delta on first frame
    lastTime = performance.now();

    // Game Loop
    requestAnimationFrame(loop);
}

function loop(time) {
    const dt = (time - lastTime) / 1000 * 20; // Normalizing to ~20 ticks/sec speed
    lastTime = time;

    // Simulation Tick
    if (dt > 0) world.tick(dt);

    // Render Tick
    renderer.render(world);
    
    // UI Update (less frequent? do every frame for smoothness for now)
    updateScienceKit();

    requestAnimationFrame(loop);
}

// --- UI Logic ---

const uiElements = {
    name: document.getElementById('creature-name'),
    state: document.getElementById('creature-state'),
    bars: {
        glucose: document.getElementById('bar-glucose'),
        pain: document.getElementById('bar-pain'),
        hunger: document.getElementById('bar-hunger'),
        boredom: document.getElementById('bar-boredom')
    },
    brainCanvas: document.getElementById('brain-canvas'),
    panels: {
        health: document.getElementById('panel-health')
    }
};

const brainCtx = uiElements.brainCanvas.getContext('2d');

function updateUISelection() {
    if (!selectedCreature) return;
    uiElements.name.innerText = "Pixie Norn Gen 1";
}

function updateScienceKit() {
    if (!selectedCreature) return;
    
    // Update State Text
    const stateNames = ['Idle', 'Left', 'Right', 'Eating', 'Sleeping', 'Jumping'];
    uiElements.state.innerText = `State: ${stateNames[selectedCreature.state] || 'Unknown'}`;

    // Update Bars
    const bio = selectedCreature.biochemistry;
    uiElements.bars.glucose.style.width = (bio.getLevel(CHEMICALS.GLUCOSE) / 255 * 100) + '%';
    uiElements.bars.pain.style.width = (bio.getLevel(CHEMICALS.PAIN) / 255 * 100) + '%';
    uiElements.bars.hunger.style.width = (bio.getLevel(CHEMICALS.DRIVE_HUNGER) / 255 * 100) + '%';
    uiElements.bars.boredom.style.width = (bio.getLevel(CHEMICALS.DRIVE_BOREDOM) / 255 * 100) + '%';

    // Always draw brain
    drawBrain(selectedCreature.brain);
}

function drawBrain(brain) {
    const ctx = brainCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Clear with transparency
    ctx.clearRect(0,0,w,h);
    
    // Connections (Visualize weights? Only strong ones)
    // For MVP just visualize activity
    
    const drawLayer = (layer, y, color) => {
        const count = layer.length;
        const gap = w / (count + 1);
        for(let i=0; i<count; i++) {
            const val = (layer[i] + 1) / 2; // Normalize tanh -1..1 to 0..1
            ctx.fillStyle = `rgba(${color}, ${val})`;
            ctx.beginPath();
            ctx.arc(gap * (i+1), y, 8, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.stroke();
        }
    };

    drawLayer(brain.inputs, 30, '0,255,0');    // Green Input
    drawLayer(brain.hidden, 75, '255,255,0');  // Yellow Hidden
    drawLayer(brain.outputs, 120, '255,0,255');// Magenta Output
}

// --- Event Listeners ---

window.addEventListener('creature-select', (e) => {
    selectedCreature = e.detail;
    updateUISelection();
});

// Panel switching
// document.getElementById('btn-health').onclick = () => showPanel('health');

function showPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-panel'));
    document.getElementById(`panel-${id}`).classList.add('active-panel');
}

document.getElementById('btn-reset').onclick = () => {
    // Basic reset
    location.reload(); 
};

// Hand Interactions
document.getElementById('hand-tick').onclick = () => {
    if(selectedCreature) {
        selectedCreature.biochemistry.inject(CHEMICALS.REWARD, 100);
        // Visual feedback?
        console.log("Tickled creature!");
    }
};

document.getElementById('hand-slap').onclick = () => {
    if(selectedCreature) {
        selectedCreature.biochemistry.inject(CHEMICALS.PUNISHMENT, 100);
        selectedCreature.biochemistry.inject(CHEMICALS.PAIN, 50);
        console.log("Slapped creature!");
    }
};

// Start
start();