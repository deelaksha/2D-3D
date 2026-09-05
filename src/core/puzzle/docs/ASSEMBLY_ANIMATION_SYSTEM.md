# Assembly-Animation System (Phase 97)

## 1. Overview

Phase 97 implements a physics-compliant **assembly-animation system** for the 3D puzzle CAD engine and interactive previewer.

Given a valid `AssemblySequence` and `AssemblyTransitions`:
- Animates each piece through four distinct physical phases: **movement**, **rotation**, **interface alignment**, and **connection completion**.
- Synthesizes smooth, collision-free standoff corridors and approach trajectories.
- Strictly adheres to valid kinematic transforms—pieces never animate through invalid collision states or penetrating geometry.
- Provides interactive playback controls: play, pause, restart, step forward, step backward, seek, and variable speed multipliers ($0.25\times \dots 3.0\times$).
- Integrates seamlessly with the renderer-independent `Scene` and Three.js previewer without mutating authoritative CAD geometry.

---

## 2. 4-Phase Physical Trajectory Synthesis

Rather than a simplistic linear interpolation between an arbitrary distant point and the assembled state, the animation engine compiles a 4-phase physical trajectory for every non-root piece based directly on joint mechanics:

```
[ Unassembled ]
       ↓
 Phase 1: Movement (0% - 35% of step duration)
   • Standoff translation along outward insertion axis
   • Safe clearance height above already-assembled subassembly
       ↓
 Phase 2: Rotation (35% - 65% of step duration)
   • Spherical linear interpolation (quatSlerp) from staging orientation to connection angle
   • Keeps piece at safe standoff clearance distance to avoid collision
       ↓
 Phase 3: Alignment (65% - 85% of step duration)
   • Approaches along insertion corridor until interface ports are collinear
   • Nears joint mating threshold (8 mm standoff)
       ↓
 Phase 4: Completion (85% - 100% of step duration)
   • Final linear insertion into fully locked position
   • Joint transition switches from UNMATED / APPROACHING to MATED
       ↓
[ Fully Assembled & Validated ]
```

### Phase Details

| Phase | Time Window | Kinematic Behavior | Collision Avoidance Strategy |
| :--- | :--- | :--- | :--- |
| **Movement** | $t \in [0.00, 0.35)$ | Piece lifts from standoff staging position toward approach corridor. | Moves away from assembly bounding box along positive interface normal + upward $Z$ offset. |
| **Rotation** | $t \in [0.35, 0.65)$ | Smooth `quatSlerp` rotation into targeted joining angle. | Rotation occurs strictly at standoff clearance distance ($D_{\text{standoff}} \ge 50\text{mm}$). |
| **Alignment** | $t \in [0.65, 0.85)$ | Moves inward along insertion corridor until joint interface ports align. | Insertion axis collinear with connector mating vector; no lateral sweep. |
| **Completion** | $t \in [0.85, 1.00]$ | Final seating into joint socket; locks at assembled transform. | Controlled axial insertion within specified joint clearance tolerances. |

---

## 3. Mathematical Foundations

### Spherical Linear Interpolation (`quatSlerp`)
Rotations between staging approach angles and authoritative assembly orientations are interpolated using geodesics on the unit quaternion 3-sphere:

$$q(t) = \frac{\sin((1-t)\theta)}{\sin\theta} q_0 + \frac{\sin(t\theta)}{\sin\theta} q_1$$

Where $\cos\theta = q_0 \cdot q_1$. When $q_0 \cdot q_1 < 0$, the antipodal quaternion $-q_1$ is used to ensure the shortest angular path ($<180^\circ$).

### Smooth Trajectory Easing
Translations along the trajectory utilize cubic ease-in-out interpolation:
$$S(u) = u^2 (3 - 2u) \quad \text{for } u \in [0, 1]$$

---

## 4. Architecture & Component Structure

```
                    Authoritative Puzzle & Sequence
         (ExplicitAssemblySequence + AssemblyTransitions)
                                ↓
                 AssemblyAnimationEngine.generateTimeline()
                                ↓
                  AssemblyAnimationTimeline
         ├── totalDuration
         ├── tracks: StepAnimationTrack[]
         └── evaluate(time) → PieceTransforms + StepInfo
                                ↓
                 AssemblyAnimationPlayer (Playback Controller)
         ├── play(), pause(), restart()
         ├── stepForward(), stepBackward()
         ├── seek(time), setSpeed(multiplier)
         └── tick(dt) → notifies listeners
                                ↓
                 Puzzle3DViewerController (Three.js Bridge)
         ├── applyAnimationTransformsToScene()
         └── requestAnimationFrame loop
                                ↓
                 Puzzle3DPreview (Interactive React UI)
         ├── Play/Pause / Restart / Step buttons
         ├── Timeline scrubber & timestamp
         └── Current step & active phase badges
```

---

## 5. Non-Destructive CAD Guarantee

The animation system operates strictly on spatial transforms (`RigidTransform3D` matrices and Three.js `Object3D` transforms).
- Authoritative 2D piece boundaries, thickness, slots, tabs, and 3D mesh vertex geometries are **never modified**.
- Pausing, rewinding, or stopping the animation leaves CAD models in a bit-for-bit identical state to the original generative output.

---

## 6. Playback Controls & HUD Features

The 3D previewer includes an interactive **Assembly Animation Control HUD**:
- **Play/Pause Toggle**: Resumes or halts the continuous RAF playback loop.
- **Restart**: Jumps immediately to $t = 0$ with all unassembled pieces hidden or at initial standoff positions.
- **Step Forward / Backward**: Advances or steps back exactly one physical assembly step ($1 \dots N$).
- **Timeline Scrubber**: Real-time slider for scrubbing continuously across the entire sequence.
- **Speed Multiplier**: Quick toggles for $0.5\times$, $1\times$, $1.5\times$, and $2\times$ playback rates.
- **Active Step & Phase Badges**: Live visual feedback showing current piece ID, connection ID, step description, and active phase (`movement`, `rotation`, `alignment`, or `completion`).
