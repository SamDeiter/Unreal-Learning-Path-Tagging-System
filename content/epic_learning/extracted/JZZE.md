# An Introduction to Niagara's Scratch Pad Modules

*This tutorial is an introduction to Scratch Pad Modules, Niagara's visual-scripted local modules.*

## 


## 


### 


### 


### 


## 


### 


### 


#### 


### 

- [{'type': 'paragraph', 'content': 'Lifetime Mode: Direct Set'}]
- [{'type': 'paragraph', 'content': 'Lifetime: 5'}]
- [{'type': 'paragraph', 'content': 'Color Mode: Direct Set'}]
- [{'type': 'paragraph', 'content': 'Color: 1, 0, 0'}]
- [{'type': 'paragraph', 'content': 'Position Mode: Simulation Position'}]
- [{'type': 'paragraph', 'content': 'Position Offset: 0, 0, 0'}]
- [{'type': 'paragraph', 'content': 'Mass Mode: Unset / (Mass of 1)'}]
- [{'type': 'paragraph', 'content': 'Sprite Size Mode: Uniform'}]
- [{'type': 'paragraph', 'content': 'Uniform Sprite Size: 10'}]
- [{'type': 'paragraph', 'content': 'Sprite Rotation Mode: Unset'}]
- [{'type': 'paragraph', 'content': 'Sprite UV Mode: Unset'}]
- [{'type': 'paragraph', 'content': 'all other Mesh and Ribbon Attributes: Unset'}]

- [{'type': 'paragraph', 'content': 'Grid Origin: PARTICLES Position'}]
- [{'type': 'paragraph', 'content': 'Coordinate Space: Local'}]
- [{'type': 'paragraph', 'content': 'Dimensions Definition: Padding Per Cell'}]
- [{'type': 'paragraph', 'content': 'XYZ Dimensions: 10, 10, 10'}]
- [{'type': 'paragraph', 'content': 'Normalize Offsets: True'}]
- [{'type': 'paragraph', 'content': 'Randomize Placement Within Cell: 1, 1, 1'}]
- [{'type': 'paragraph', 'content': 'Offset: 0, 0, 0'}]
- [{'type': 'paragraph', 'content': 'Placement Randomness Mode: Simulation Defaults'}]
- [{'type': 'paragraph', 'content': 'Random Placement Seed: 0'}]
- [{'type': 'paragraph', 'content': 'Use A Custom Transformation: false'}]


## 


### 

- [{'type': 'paragraph', 'content': "Select the Scratch Module's tab, located next to the System Overview tab, towards the top of the window"}]
- [{'type': 'paragraph', 'content': 'Select the Scratch Module in the Emitter, then click the scratch pad button in the Details panel'}]
- [{'type': 'paragraph', 'content': 'Double-click on the Scratch Module stack entry in the Emitter'}]
- [{'type': 'paragraph', 'content': 'Double-click on the Scratch Module in the Local Modules &gt; Modules list'}]


## 


## 


### 


### 


### 


## 


### 


## 


## 


### 

- [{'type': 'paragraph', 'content': 'Function'}]
- [{'type': 'paragraph', 'content': 'Module (enabled by default)'}]
- [{'type': 'paragraph', 'content': 'Dynamic Input'}]
- [{'type': 'paragraph', 'content': 'Particle Spawn Script (enabled by default)'}]
- [{'type': 'paragraph', 'content': 'Particle Update Script (enabled by default)'}]
- [{'type': 'paragraph', 'content': 'Particle Event Script (enabled by default)'}]
- [{'type': 'paragraph', 'content': 'Particle Simulation Stage Script (enabled by default)'}]
- [{'type': 'paragraph', 'content': 'Emitter Spawn Script'}]
- [{'type': 'paragraph', 'content': 'Emitter Update Script'}]
- [{'type': 'paragraph', 'content': 'System Spawn Script'}]
- [{'type': 'paragraph', 'content': 'System Update Script'}]


### 


## 


### 


### 


### 


### 


## 


### 

- [{'type': 'paragraph', 'content': 'System Attributes (e.g. SYSTEM.Age, SYSTEM.LoopCount)'}]
- [{'type': 'paragraph', 'content': 'Emitter Attributes (e.g. EMITTER.Age, EMITTER.DistanceTraveled)'}]
- [{'type': 'paragraph', 'content': 'Particle Attributes (e.g. PARTICLES.Position, PARTICLES.SpriteSize)'}]
- [{'type': 'paragraph', 'content': 'Module Outputs (e.g. OUTPUT.GRIDLOCATION.GridSpacing, OUTPUT.PARTICLESTATE.FirstFrame)'}]
- [{'type': 'paragraph', 'content': 'Engine Provided (e.g. ENGINE.DeltaTime, ENGINE.EMITTER.NumParticles, ENGINE.OWNER.Velocity)'}]
- [{'type': 'paragraph', 'content': 'Stage Transients (e.g. TRANSIENT.FirstFrame, TRANSIENT.ScalabilityExecutionState)'}]

- [{'type': 'paragraph', 'content': 'User Exposed (same as in the User Parameters tab)'}]
- [{'type': 'paragraph', 'content': 'Stack Context Sensitive'}]
- [{'type': 'paragraph', 'content': 'Niagara Parameter Collection'}]


## 


### 


## 


### 

- [{'type': 'paragraph', 'content': 'Default Mode: options include Binding, Custom, Fail if Previously Not Set, and default Value'}]
- [{'type': 'paragraph', 'content': 'Default Value: based on type, such as float, vector, etc.'}]
- [{'type': 'paragraph', 'content': 'Tooltip (and localization options): add helpful implementation details, units, caveats, or other notes that are valuable to users'}]
- [{'type': 'paragraph', 'content': 'Display Unit: many options, such as Centimeters, Lumens, Hours, Gigabytes, Grams, Degrees, and the default Unspecified'}]
- [{'type': 'paragraph', 'content': 'Advanced Display: false by default'}]
- [{'type': 'paragraph', 'content': 'Display in Overview Stack: false by default'}]
- [{'type': 'paragraph', 'content': 'Inline Parameter Sort Priority and Color Override: disabled by default'}]
- [{'type': 'paragraph', 'content': 'Edit Condition and Visible Condition (Input Name and Target Values): None and 0 elements by default'}]
- [{'type': 'paragraph', 'content': 'Property Metadata: 0 elements by default'}]
- [{'type': 'paragraph', 'content': 'Alternate Aliases for Variable: 0 elements by default'}]
- [{'type': 'paragraph', 'content': 'Widget Type: Default'}]
- [{'type': 'paragraph', 'content': 'Min Value: 0 by default'}]
- [{'type': 'paragraph', 'content': 'Max Value: 1 by default'}]
- [{'type': 'paragraph', 'content': 'Step Width: 1 by default'}]
- [{'type': 'paragraph', 'content': 'Broadcast Value Change On Commit Only: false (set to true if you only want values to be updated when committed, not when typing)'}]


### 


### 


## 


### 


### 


## 

- [{'type': 'paragraph', 'content': "Simulation – Calculations are done in whatever context (Local or World) that is set in the Emitter's Properties section, as defined by Local Space set to true or false."}]
- [{'type': 'paragraph', 'content': 'World – Calculations are done in the context of the world values.'}]
- [{'type': 'paragraph', 'content': 'Local – Calculations are done in the context of the system itself, regardless of where it is in the world.'}]


### 


### 


### 


## 


## 


### 


### 


### 


### 


## 


### 


### 


### 


## 


### 


### 


### 


## 


### 


## 


### 


### 


### 


### 


## 


## 

- [{'type': 'paragraph', 'content': 'System & Emitter Spawn'}]
- [{'type': 'paragraph', 'content': 'System & Emitter Update'}]
- [{'type': 'paragraph', 'content': 'Particles Spawn & Particle Updates (per Emitter)'}]
- [{'type': 'paragraph', 'content': 'Simulation Stages'}]


### 


### 


### 


## 


### 


### 


### 


## 


### 


#### 


#### 


### 


### 


### 


### 


## 


##