# Creatures Web Remake (2026 Blueprint)

A browser-based Artificial Life simulation inspired by the 1996 classic "Creatures" by Steve Grand.

## Overview
This prototype implements the core "CyberLife" loop:
1. **Biochemistry**: A bloodstream simulates energy (Glucose), drives (Hunger), and emotions (Pain/Reward).
2. **Neural Network**: A simplified Hebbian learning network processes senses and drives to output actions.
3. **World**: A 2D scrolling environment where Norns interact with objects.

## Controls
- **Click Norn**: Selects the creature to monitor.
- **Science Kit (Top Right)**:
    - **Health**: Monitor chemical levels.
    - **Brain**: Watch the neural network fire in real-time.
- **Hand Controls (Bottom)**:
    - **Pat**: Reinforce current behavior (releases Reward chemical).
    - **Slap**: Discourage current behavior (releases Punishment/Pain chemical).

## How to Play
Observe the Norn. It starts with no knowledge.
1. When it eats a carrot, it naturally gains Glucose (Energy) and a small Reward.
2. The brain connects "See Carrot" -> "Eat" because of this reward.
3. If it does something you like (e.g. eating), click **Pat**.
4. If it does something you dislike (e.g. sleeping when not tired), click **Slap**.