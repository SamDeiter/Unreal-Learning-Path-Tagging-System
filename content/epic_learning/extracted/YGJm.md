# Niagara Examples Pack: Impacts

*This tutorial gives an overview of the impact system available within the Niagara Examples Pack.

Import the Niagara Examples Pack from FAB to follow along.*

- [{'type': 'paragraph', 'content': 'Spawning systems for each impact is a standard method for handing weapon systems. The methodology is generally easier to set up for both static and moving targets.'}, {'type': 'paragraph', 'content': 'Spawning a new system component into the world for every impact can be a performance issue however simply due to the volume of actors which may need to be evaluated.\xa0'}]
- [{'type': 'paragraph', 'content': 'Niagara Data Channels are used to pass data from the firing system (blueprint or C++) to a Niagara system. One Niagara system can spawn multiple impacts resulting in much fewer Niagara systems being spawned into the world. Reducing the actor count in the world is a highly valuable optimization.'}, {'type': 'paragraph', 'content': 'While using Niagara Data Channels for weapon firing systems, especially rapid firing scenarios is recommended, it does have some drawbacks such as translucency sorting between impacts.'}]


### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<b>Burst Amount</b> - Controls the quantity of particles spawned by the system. The amount is not a hard particle count but a general quantity shared across the different emitters.'}]
- [{'type': 'paragraph', 'content': "<b>Variability </b>- This is a 0-1 value which indicates how different each impact should appear when triggered. If Variability is set to zero every impact will look very similar. A value of 1 will cause each hit to be different in scale and quantity of 'damage' spawned."}]
- [{'type': 'paragraph', 'content': '<b>Base Color</b> - Influences the color of the dust, dirt and debris elements.'}]
- [{'type': 'paragraph', 'content': '<b>Hit Velocity</b>, <b>Hit Direction</b> and <b>Hit Normal</b> are passed from the line trace hit result structure and are not typically set manually.'}]


#### 

- [{'type': 'paragraph', 'content': '<b>Burst Direction</b> - Specifies the local space vector that particles will move along. The local X axis is the primary axis. A reflection vector is also calculated from the Hit Direction and Hit Normal passed in from the blueprint which spawned the system. The final direction is a mix between these two direction.'}]
- [{'type': 'paragraph', 'content': '<b>Local Hit Velocity</b> - The velocity of the surface which has been hit. In this case the velocity is passed from the blueprint which spawned the system. The owner velocity can be queried from the system directly but it may not be reliable on the first frame after spawning. This velocity is used to inherit the motion from the hit surface.'}]
- [{'type': 'paragraph', 'content': '<b>Distance Scale/Emit Scale</b> - These are multipliers which use the LOD Distance to compensate for the impact being spawned close to camera or very far from camera. Attributes such as size and spawn rate can be modified for visibility and to reduce particle counts. The default scales and distances can be adjusted to your specific needs.'}]
- [{'type': 'paragraph', 'content': 'Spark/Smoke/Debris/Dirt Pct - These attributes control the relative amount of particles burst for each element. The values are within a 0-1 range and can be used to bias the number of sparks in relation to the debris count as an example.'}]


### 

- [{'type': 'paragraph', 'content': 'The Niagara Data Channel asset (<b>NDC_Impacts</b>) defines the type of NDC and the data it can hold.'}]
- [{'type': 'paragraph', 'content': 'The Niagara System (<b>NS_NDC_Impacts</b>) reads data in the Data Channel on every frame. If data exists it will spawn an impact effect at the location specified in the Data Channel.'}]

- [{'type': 'paragraph', 'content': 'A <b>Data Channel Reader</b> is defined at the system level. Every emitter in the system can access this reader.'}]
- [{'type': 'paragraph', 'content': 'In Emitter Update particles are spawned based on the number of entries found within the Data Channel on the current frame. There will be one data channel entry per impact. The <b>Spawn Direct</b> scratch module will spawn a user defined number of particles for each impact.'}]
- [{'type': 'paragraph', 'content': 'In Particle Spawn the Data Channel data is used by each spawned particle to initialize its data. The <b>Read from NDC</b> scratch module queries the Data Channel and copies that data to attributes on the spawned particle. Each module following can then use the data to define various attributes such as position and velocity.'}, {'type': 'paragraph', 'content': 'In the screen shot below you can see that the particle position is initialized to <b>PARTICLES.READ FROM NDC.Position</b>. This has been read directly from the Data Channel.'}]


#### 


#### 

- [{'type': 'paragraph', 'content': 'Line trace impacts instantly hit the surface being aimed at.'}]
- [{'type': 'paragraph', 'content': 'Projectile based impacts spawn a projectile which is shot from the weapon and impacts on collision. It is subject to gravity and takes time to travel from the weapon to the target.'}]

- [{'type': 'paragraph', 'content': 'The Line Trace By Channel blueprint function returns a Hit Result Structure directly.'}]
- [{'type': 'paragraph', 'content': 'When a projectile collides with a surface the <b>On Component Hit</b> event returns a Hit Result Structure.'}]