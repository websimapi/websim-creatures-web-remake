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
    
    // Limit dt to prevent spirals
    if (dt > 5) return; 
    
    world.tick(dt);
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
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0,0,w,h);
    
    const layers = [brain.inputs, brain.hidden, brain.outputs];
    const colors = ['#0f0', '#ff0', '#f0f'];
    
    layers.forEach((layer, li) => {
        const y = 30 + (li * 40);
        const count = layer.length;
        const spacing = w / (count + 1);
        
        for(let i=0; i<count; i++) {
            const act = (layer[i] + 1) / 2; // -1..1 -> 0..1
            ctx.fillStyle = colors[li];
            ctx.globalAlpha = 0.3 + (act * 0.7);
            ctx.beginPath();
            ctx.arc(spacing * (i+1), y, 6, 0, Math.PI*2);
            ctx.fill();
            if(act > 0.8) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    });
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