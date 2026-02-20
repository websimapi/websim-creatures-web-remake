import { World, CHEMICALS } from './simulation.js';
import { GameRenderer } from './renderer.js';

// 1. Setup
const WORLD_W = 1600;
const WORLD_H = 600;

const world = new World(WORLD_W, WORLD_H);
const renderer = new GameRenderer('game-container', WORLD_W, WORLD_H);

let selectedCreature = null;

async function boot() {
    await renderer.init();
    
    const c = world.addCreature();
    selectedCreature = c;
    
    loop();
}

let lastT = performance.now();
function loop() {
    requestAnimationFrame(loop);
    
    const now = performance.now();
    const dt = (now - lastT) / 1000 * 60; // Tick relative to 60fps
    lastT = now;
    
    // Limit dt to prevent spirals and huge physics jumps
    // If dt is too high, we clamp it. 
    const clampedDt = Math.min(dt, 2.0); 
    
    world.tick(clampedDt);
    renderer.render(world);
    updateUI();
}

function updateUI() {
    if(!selectedCreature) return;
    
    // Brain
    drawBrain(selectedCreature.brain);
    
    // Bars
    const setBar = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.style.width = (val/255*100) + '%';
    }
    setBar('bar-glucose', selectedCreature.bio.getLevel(CHEMICALS.GLUCOSE));
    setBar('bar-pain', selectedCreature.bio.getLevel(CHEMICALS.PAIN));
    setBar('bar-hunger', selectedCreature.bio.getLevel(CHEMICALS.HUNGER));
    
    document.getElementById('creature-state').innerText = `State: ${selectedCreature.state}`;
}

function drawBrain(brain) {
    const canvas = document.getElementById('brain-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0,0,w,h);
    
    // Connection lines (Input -> Hidden)
    const l1Y = 30;
    const l2Y = 70;
    const l3Y = 110;
    
    const spacing1 = w / (brain.inputs.length + 1);
    const spacing2 = w / (brain.hidden.length + 1);
    const spacing3 = w / (brain.outputs.length + 1);

    ctx.lineWidth = 1;
    // Draw weights I->H (Sample) - only draw strong ones to keep it clean
    for(let i=0; i<brain.inputs.length; i++) {
        for(let j=0; j<brain.hidden.length; j++) {
            const weight = brain.wIH[i*brain.hiddenSize + j];
            if(Math.abs(weight) > 1.0) {
                ctx.strokeStyle = weight > 0 ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
                ctx.beginPath();
                ctx.moveTo(spacing1*(i+1), l1Y);
                ctx.lineTo(spacing2*(j+1), l2Y);
                ctx.stroke();
            }
        }
    }

    // Nodes
    const drawLayer = (layer, y, spacing, color) => {
        for(let i=0; i<layer.length; i++) {
            const act = (layer[i] + 1) / 2; // -1..1 -> 0..1
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.3 + (act * 0.7);
            ctx.beginPath();
            ctx.arc(spacing * (i+1), y, 5, 0, Math.PI*2);
            ctx.fill();
            // Highlight active
            if(Math.abs(layer[i]) > 0.5) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    };

    drawLayer(brain.inputs, l1Y, spacing1, '#0f0');
    drawLayer(brain.hidden, l2Y, spacing2, '#ff0');
    drawLayer(brain.outputs, l3Y, spacing3, '#f0f');
    
    ctx.globalAlpha = 1.0;
}

// Controls
window.addEventListener('creature-select', (e) => selectedCreature = e.detail);

document.getElementById('hand-tick').onclick = () => {
    if(selectedCreature) selectedCreature.bio.inject(CHEMICALS.REWARD, 100);
}
document.getElementById('hand-slap').onclick = () => {
    if(selectedCreature) {
        selectedCreature.bio.inject(CHEMICALS.PUNISHMENT, 100);
        selectedCreature.bio.inject(CHEMICALS.PAIN, 50);
    }
}
document.getElementById('btn-reset').onclick = () => location.reload();

boot();