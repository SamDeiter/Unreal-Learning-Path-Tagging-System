# Control Rig Physics

*Learn how to add physics to a Control Rig for use in games and animation*

## 


### 

- [{'type': 'paragraph', 'content': 'Physics Solver. This acts as a local "world" with its own settings, separate from the global game world and solvers. It manages the simulation of the Physics Bodies it contains.'}]
- [{'type': 'paragraph', 'content': 'Physics Body. This represents the movement and collision properties associated with an element (typically a bone) in the hierarchy. It needs to be added to a Physics Solver to be updated.'}]
- [{'type': 'paragraph', 'content': 'Physics Joint. This connects two bodies together in two ways. It limits the movement between them, typically by pinning them together (with a joint or articulation), as well as limiting the angular movement. It can also be used to drive them towards a target, behaving like a motor in a robot, or a muscle in a creature.'}]
- [{'type': 'paragraph', 'content': 'Physics Control. This is typically used to control one body relative to another (where the second body can be the world/simulation itself), using soft/springy physical constraints.'}]


## 


### 


### 


### 


### 


## 


## 

- [{'type': 'paragraph', 'content': 'After the main solve that generates the pose based on the manipulators, so that this pose is available to physics.'}]
- [{'type': 'paragraph', 'content': "Before the Jiggle solve, so that the little cables, etc, will respond to the physics movement that we'll be adding in a moment."}]


## 

- [{'type': 'paragraph', 'content': 'Adding physics to every bone in the Mech is unnecessary. We should limit ourselves to just the important ones.'}]
- [{'type': 'paragraph', 'content': 'There is nothing holding the bodies together.'}]
- [{'type': 'paragraph', 'content': 'The collision shapes (shown as yellow boxes) are automatically estimated based on the bones in the hierarchy at construction time. Sometimes they are OK, but sometimes they are not as good as they need to be. These shapes are causing unwanted collisions and overlaps.'}]


### 

- [{'type': 'paragraph', 'content': 'The "Use Automatic Solver" option is checked. This means that the system will look above main_gun in the hierarchy and add the body to the first Physics Solver it finds. That\'s why we added the Physics Solver to the root bone. Note that if you have a complex rig, you can uncheck this option and specify the Physics Body\'s solver location explicitly.'}]
- [{'type': 'paragraph', 'content': "The Source Bone says what bone should be used to determine the transform for this body when it is kinematic (see below). By default, it's set to the Physics Body's owner."}]
- [{'type': 'paragraph', 'content': "The Target Bone says what bone should have its transforms set by the movement of this body. By default, it will be the Physics Body's owner."}]
- [{'type': 'paragraph', 'content': "The Shapes section contains the collision shapes associated with this Physics Body. If it's empty when the component is constructed, the system tries to calculate them automatically, based on the bones above and below in the hierarchy. You can modify the shapes if these are not satisfactory, as we will see in a moment."}]
- [{'type': 'paragraph', 'content': 'The Body Data section contains properties that will often be modified as the simulation progresses. The Movement Type is most important: When set to simulated, the body will move freely, falling under gravity, with inertia, etc. When set to kinematic, the body will always track the incoming animation (using the Source Bone).'}]


## 

- [{'type': 'paragraph', 'content': 'By default, a Physics Joint connects a Physics Body to a Physics Body above it in the hierarchy (navigating via the bones). You can override this if you wish, by manually specifying the bodies to be connected in the Parent/Child Body Component Keys.\xa0'}]
- [{'type': 'paragraph', 'content': 'The Physics Joint limits movement between the parent and child bodies. By default, it allows for no linear movement at all, which "pins" the bodies together at the positions corresponding to the bone joints. You can limit or disable the linear movement in the Linear Constraint settings (during creation, or afterwards).'}]
- [{'type': 'paragraph', 'content': "By default, it doesn't limit the angular movement at all. That's why some of the bones spin around unrealistically in the video above. You can limit the angular movement in the Cone and Twist Constraint settings."}]
- [{'type': 'paragraph', 'content': 'The Physics Joint also provides linear and angular motor drives. The angular motor drive is most likely to be useful, as it operates like "muscles" in a character. If you enable these options in the Angular Drive settings, you can make the simulated Mech physically track the animated pose.\xa0'}]


## 

- [{'type': 'paragraph', 'content': 'Adjust some of the visualization settings on the Step Physics Solver Node (see the image below)'}]
- [{'type': 'paragraph', 'content': 'Pause the simulation using the cvar `ControlRig.Physics.MaxDeltaTimeOverride 0.0` (set it to -1 to resume simulation)'}]


## 

- [{'type': 'paragraph', 'content': 'You can imagine that there is a bouncy spring between the body and the target. This spring pulls the body into place.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If the target is accelerating, then the body will lag behind the target, "playing catch-up".'}], [{'type': 'paragraph', 'content': 'In the absence of gravity or any other interference, if the target is stationary, the body will move towards it. If the target is moving at a constant speed, the body will track it exactly.'}]]}]
- [{'type': 'paragraph', 'content': 'You can imagine that there is a damper system between the body and the target. This damper attempts to equalise the velocities of the body and its target.\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If the target moves at a constant velocity, the body will be "dragged" until it matches that velocity, even if it is displaced from the target.'}], [{'type': 'paragraph', 'content': 'If the target is accelerating, the body will track that acceleration, but only partially.'}], [{'type': 'paragraph', 'content': 'If the spring itself has no strength (i.e. there is no damping), the body will not get pulled towards the target by the damper.'}]]}]


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Physics Body'}]
- [{'type': 'paragraph', 'content': 'Physics Joint'}]
- [{'type': 'paragraph', 'content': 'Parent-space control'}]
- [{'type': 'paragraph', 'content': 'Simulation-space control'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Strength. The bigger this number is, the stronger the spring pull on the body towards its target pose. The number has a real meaning: In the absence of any damping, this is the frequency at which the body/bodies would oscillate around the target. For example, a strength of two would mean that, when damping is zero, the bodies would wobble at a rate of twice per second.'}]
- [{'type': 'paragraph', 'content': 'Damping Ratio. When there is some strength in the spring, and this number is less than one, the bodies will oscillate around their target. When it is one, there will just be no oscillation (for the case of two bodies, anyway!). When it is greater than one, there will be even more damping on the movement.\xa0'}]
- [{'type': 'paragraph', 'content': 'Extra Damping. The Damping Ratio adds damping when the spring has strength, but sometimes you want damping even when the spring has no strength. This allows you to do that.'}]


### 

- [{'type': 'paragraph', 'content': 'You might want to use highly customised values for the strengths on different controls - for example, the shoulder might need a strength of 20, the elbow 15, and the wrist 10, to represent "strong" movement. The multipliers would then allow you to apply a multiplier of 0.5 to all controls to achieve a medium-strength movement, while still preserving the differences.'}]
- [{'type': 'paragraph', 'content': 'The linear multipliers allow you to adjust the strength of controls separately in different directions. For example, by using a linear strength Z value of zero, you could control a body horizontally, but let it fall naturally under gravity.'}]


### 

- [{'type': 'paragraph', 'content': 'The animation pose evaluated at the point Step Physics Solver is called. This is used if "Use Skeletal Animation" is set in the Control Data'}]
- [{'type': 'paragraph', 'content': 'An explicit target position (etc) specified in the Control Target section. This is applied on top of the animation pose above.'}]

- [{'type': 'paragraph', 'content': '"Use Skeletal Animation" is enabled, and the control target is zero. This just makes the Physics Control track the target animation'}]
- [{'type': 'paragraph', 'content': '"Use Skeletal Animation" is enabled, and the control target is non-zero. Now the Physics Control will track the target animation, with the control target being used as an offset. For example, if the control target position has X = 10, the actual target will be offset by 10 in the (local) X direction (e.g. displacing the foot forwards by 10 units).'}]
- [{'type': 'paragraph', 'content': '"Use Skeletal Animation" is disabled. Now the control target will be in simulation space. This might be useful for driving a body towards a point in space.'}]


## 


## 


### 


### 

- [{'type': 'paragraph', 'content': 'Read the control Mode channel, and use that to decide whether bodies in the limb should be kinematic or simulated.'}]
- [{'type': 'paragraph', 'content': 'Update the gravity multiplier on the limb bodies.'}]
- [{'type': 'paragraph', 'content': 'Make a call to update the controls on the limb bodies.'}]


## 


## 


## 


### 


### 

- [{'type': 'paragraph', 'content': 'It uses the Locomotor for most of the movement,\xa0but at times, there is additional animation applied on top.'}]
- [{'type': 'paragraph', 'content': 'The gun target is switched from parent- to world-space and back a number of times'}]
- [{'type': 'paragraph', 'content': 'Physics properties are keyed on the whole body, with overrides for the legs and cannon, to adjust gravity, strength, and control methods.\xa0'}]
- [{'type': 'paragraph', 'content': 'The falling ball is simulated in the global solve. Collision from this is passed to the Mech. Note that the ball is only simulated during PIE (including when rendering the movie sequence).'}]


### 


##