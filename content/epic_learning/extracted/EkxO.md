# Procedural Animation with a Locomotor

*Learn how to setup the Locomotor node in Control Rig to generate procedural locomotion in Unreal Engine.*

### 


### 


### 

- [{'type': 'paragraph', 'content': 'Pelvis Motion'}]
- [{'type': 'paragraph', 'content': 'Feet Motion'}]


### 

- [{'type': 'paragraph', 'content': 'Select Edit &gt; Plugins'}]
- [{'type': 'paragraph', 'content': 'Search for "Locomotor"'}]
- [{'type': 'paragraph', 'content': 'Check the box beside it, and restart your project.'}]


### 

- [{'type': 'paragraph', 'content': 'Find the skeletal mesh asset in <i>/Wolf/Meshes</i>\xa0(it is called "SK_Wolf")'}]
- [{'type': 'paragraph', 'content': 'Right-click on the skeletal mesh and select <i>Create &gt; Control Rig</i>'}]
- [{'type': 'paragraph', 'content': 'Double-click on the Control Rig to open up the Control Rig Editor'}]


### 

- [{'type': 'paragraph', 'content': 'In the Rig Hierarchy tab, right click on the "root" bone and select New Element &gt; New Control.'}]
- [{'type': 'paragraph', 'content': 'Rename the newly created control "Target_Ctrl".'}]
- [{'type': 'paragraph', 'content': 'Select the Target_Ctrl and in the Details tab, open the Shape Properties section. Select the Circle_Thick shape type.'}]
- [{'type': 'paragraph', 'content': 'Under the Shape Transform section, set the Scale X,Y,Z values to 10.0.'}]

- [{'type': 'paragraph', 'content': 'Hit "Compile" so that the Rig Graph is aware of the new control we created.'}]
- [{'type': 'paragraph', 'content': 'Right click in the empty Rig Graph view and search for Locomotor, then press Enter to make a new Locomotor node.'}]
- [{'type': 'paragraph', 'content': 'Click on Root Control in the Locomotor node and in the dropdown menu select the Target_Ctrl we just created.'}]
- [{'type': 'paragraph', 'content': 'Drag the execute pin of the Forwards Solve node into the Execute pin of the Locomotor'}]
- [{'type': 'paragraph', 'content': 'In the Locomotor node open Pelvis &gt; Pelvis Bone and set it to Wolf_-Pelvis'}]
- [{'type': 'paragraph', 'content': 'Hit Compile and verify that everything is setup as in the picture below.'}]

- [{'type': 'paragraph', 'content': 'In the Locomotor node, collapse all sections, then click on the + icon next to Foot Sets'}]
- [{'type': 'paragraph', 'content': 'Click on the "+" icon twice to add two feet to the first Foot Set.'}]
- [{'type': 'paragraph', 'content': 'In the first foot, set the Ankle Bone type to Bone and set it to the Wolf_-L-Finger0 bone (the front left paw).'}]
- [{'type': 'paragraph', 'content': 'Set the second Ankle Bone to Wolf_-R-Finger0 (front right paw)'}]
- [{'type': 'paragraph', 'content': 'Compile the rig.'}]

- [{'type': 'paragraph', 'content': 'Add another Foot Set by clicking the + icon next to Foot Sets.'}]
- [{'type': 'paragraph', 'content': 'Add two feet to the new foot set by clicking the + icon twice.'}]
- [{'type': 'paragraph', 'content': 'Set the first Ankle Bone to Wolf_-L-Foot'}]
- [{'type': 'paragraph', 'content': 'Set the second Ankle Bone to Wolf_-R-Foot'}]
- [{'type': 'paragraph', 'content': 'Hit compile'}]


### 

- [{'type': 'paragraph', 'content': 'Open the second Foot Set'}]
- [{'type': 'paragraph', 'content': 'Set the Phase Offset to 0.75'}]


### 


### 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Right click in the rig graph and create a Full Body IK node'}]
- [{'type': 'paragraph', 'content': 'Connect the execute output pin of the Locomotor to the execute input pin of the FBIK node.'}]
- [{'type': 'paragraph', 'content': 'Set the "Root" of the FBIK to the Wolf_-Pelvis'}]
- [{'type': 'paragraph', 'content': 'Click the "+" icon next to Effectors to add 4 effectors and assign the bone in the same order as the locomotor feet sets: '}, {'type': 'paragraph', 'content': 'Wolf_-L-Finger0,\xa0Wolf_-R-Finger0, Wolf_-L-Foot, Wolf_-R-Foot'}]
- [{'type': 'paragraph', 'content': 'Set the Chain Depth of each effector to 3'}]
- [{'type': 'paragraph', 'content': 'Drag a pin off the Feet Transforms output of the Locomotor and type "At" then press Enter. This will create a node than indexes into the foot transform array.'}]
- [{'type': 'paragraph', 'content': 'Get all four of the feet transforms (indices: 0, 1, 2, 3) and plug them into the equivalent effector transforms'}]
- [{'type': 'paragraph', 'content': 'For each effector, set the "Chain Depth" to 3. This will force the IK to solve the first 3 leg bones before it affects the body. This helps avoid unwanted wobble on the body.'}]

- [{'type': 'paragraph', 'content': 'Click the + icon next to Bone Settings'}]
- [{'type': 'paragraph', 'content': 'Set the Bone to Wolf_-L-Hand'}]
- [{'type': 'paragraph', 'content': 'Check "Preferred Angles" on'}]
- [{'type': 'paragraph', 'content': 'Set the Preferred Angles to 0, 0, 30'}]

- [{'type': 'paragraph', 'content': 'Add another effector to the FBIK node and set it to the Wolf_-Head bone'}]
- [{'type': 'paragraph', 'content': 'Set <i>all</i> the effector parameters to 0'}]


### 

- [{'type': 'paragraph', 'content': 'Open the Preview Scene Settings tab'}]
- [{'type': 'paragraph', 'content': 'In the Animation section, set the Preview Controller to Use Specific Animation'}]
- [{'type': 'paragraph', 'content': 'Select the ANIM_Wolf_IdleLookAround animation'}]


###