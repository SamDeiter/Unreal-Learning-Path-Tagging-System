# A Tech Artist’s Playbook for Chaos Performance

*The purpose of this article is to highlight Chaos settings and asset-authoring choices that most impact physics performance.*

## 


### 


#### 


#### 


### 


#### 

- [{'type': 'paragraph', 'content': '<b>Query</b>: the component is considered by scene queries (line traces, sweeps, overlaps);'}]
- [{'type': 'paragraph', 'content': '<b>Physics</b>: the component participates in rigid body simulation, responses to collisions;'}]
- [{'type': 'paragraph', 'content': '<b>Probe</b>: the component generates contact data during simulation but does not block or apply forces, systems running on the physics thread can react to those contacts.\xa0\xa0'}]


#### 

- [{'type': 'paragraph', 'content': 'Ignore vs. Overlap -&gt; Ignore;'}]
- [{'type': 'paragraph', 'content': 'Overlap vs. Block -&gt; Overlap;'}]
- [{'type': 'paragraph', 'content': 'Block vs. Block -&gt; Block.'}]


#### 


### 


#### 


#### 


#### 


#### 


#### 


## 


### 


#### 


##### 


##### 


##### 


##### 


##### 


#### 


##### 


##### 


##### 

- [{'type': 'paragraph', 'content': 'Avoid small faces on convex hulls. During collision resolution, Chaos only considers a single contact face from a convex hull per iteration. If it contains many tiny faces, the solver may switch between them frame to frame, we don’t get a stable contact manifold and introduce jitter.'}]
- [{'type': 'paragraph', 'content': 'Avoid tiny mass/inertia on small objects, they are more prone to bounce and jitter. Raising the\xa0Mass Scale\xa0and\xa0Inertia Tensor Scale\xa0slightly on the problematic objects. Chaos also has an “Inertia Conditioning” option on static meshes’ detail panel; it increases inertia automatically when an object is long and thin.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': 'Add a little Linear Damping and Angular Damping on problematic objects, it bleed off micro-energy and stabilize simulated bodies.'}]
- [{'type': 'paragraph', 'content': 'Try lowering the Restitution when appropriate because high restitution prolongs contact cycling.(See settings in the Physical Material)'}]


##### 


### 


#### 


#### 


#### 


#### 


#### 


## 


### 


#### 

- [{'type': 'paragraph', 'content': '<b>Solver Iterations</b>'}, {'type': 'paragraph', 'content': 'Adjust this based on the joint and collision complexity. The default value may be excessive in simple cases.'}]
- [{'type': 'paragraph', 'content': '<b>Cull Distance</b>'}, {'type': 'paragraph', 'content': 'It’s the distance at which collisions are ignored, adjust it according to the relative body movement in your simulation, so the solver doesn’t need to evaluate distant, non-contributing collisions.'}]
- [{'type': 'paragraph', 'content': '<b>Deferred Simulation</b>'}, {'type': 'paragraph', 'content': 'If a Rigid Body Node’s Simulation Timing is set to Deferred, the simulation will run on a worker thread and the result will be applied in the next frame. This introduces a one-frame delay, which is often acceptable and helps avoid stalls from sequential evaluation.'}, {'type': 'image', 'image_id': 78047, 'caption': '', 'alt_text': '', 'image': {'id': 78047, 'file_name': 'RBAN_DeferedSimulation.png', 'file_size': 59840, 'content_type': 'image/png', 'created_at': '2025-09-29T14:53:45.787+00:00', 'height': 346, 'width': 1110, 'storage_key': '047f7c84-a146-4de4-8693-6facda55bfb4', 'context': 'learning'}, 'storage_key': '047f7c84-a146-4de4-8693-6facda55bfb4', 'context': 'learning', 'width': None}]


#### 


#### 

- [{'type': 'paragraph', 'content': '<b>Stabilize long chains</b>'}, {'type': 'paragraph', 'content': 'Gradually reduce mass and inertia along the chain. While this introduces non-physical behavior, it helps the solver converge faster at low iterations.'}]
- [{'type': 'paragraph', 'content': '<b>Reducing jittering bodies</b>'}, {'type': 'paragraph', 'content': 'Same as the world rigid body solver,\xa0make sure small bodies have enough inertia by increasing the Inertial Tensor Scale and enabling Inertial Conditioning;'}, {'type': 'paragraph', 'content': 'Add some amount of Linear and Angular Damping on problematic bodies'}, {'type': 'paragraph', 'content': "Consider turn on Disable Collision for joints, so the solver doesn't need to consider collisions between connected bodies."}]
- [{'type': 'paragraph', 'content': '<b>Fast moving objects</b>'}, {'type': 'paragraph', 'content': 'Simulating in Ref Bone Space can improve stability. You can then blend world-space influence back in using the World Alpha parameter under Sim Space Settings.'}]
- [{'type': 'paragraph', 'content': '<b>Constraint Projection</b>'}, {'type': 'paragraph', 'content': 'Most of the time for RBAN, we enable projection on constraints except for cross constraints; it corrects bodies that drift behind in a non-physical manner when constraints are not satisfied at low iterations.'}]


### 


#### 


#### 


#### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<b>Substeps and Iterations</b>'}, {'type': 'paragraph', 'content': 'Adjust the number of substeps and solver iterations for each LOD. When characters move away, we often want to disable cloth simulation and settle on skinning, which can be done by deleting the SimulationSolverConfig for higher LODs.\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Mesh Optimization</b>'}, {'type': 'paragraph', 'content': 'Both the sim mesh and render mesh should be optimized for higher LODs, in the cloth asset template, it uses the Remesh node to cut down their overall density.'}]
- [{'type': 'paragraph', 'content': '<b>Character Collision</b>'}, {'type': 'paragraph', 'content': 'The SimulationCollisionConfig provides options to enable or disable simple and complex collisions separately. If your character’s Physics Asset includes complex kinematic colliders, consider using them only on lower LODs.'}]
- [{'type': 'paragraph', 'content': '<b>Self Collision</b>'}, {'type': 'paragraph', 'content': "Since it's performance-heavy, consider connecting self-collision nodes only on nearby characters."}]