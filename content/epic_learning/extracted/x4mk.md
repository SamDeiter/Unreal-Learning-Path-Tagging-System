# Maya to Unreal Engine - The Ultimate Coordinate conversion Cheat Sheet

*Matching transformations ( position, rotation and scale) from a right handed Y-up coordinate system like Maya to a left handed Z-up system like Unreal Engine requires swapping the Y and Z values for position and scale. Rotation requires an additional sign flip due to differing conventions on the Z-axis.*

## 

- [{'type': 'paragraph', 'content': 'Your Thumb represents the X-axis, Index Finger represents the Y-axis (Up) and Middle Finger represents the Z-axis.'}]

- [{'type': 'paragraph', 'content': 'Rotation 1 : Now, rotate your hand 90 degrees counter-clockwise around the Y-axis. This aligns the X-axis to your right direction for consistency with the right handed coordinate system (only for the ease of visualization).'}]
- [{'type': 'paragraph', 'content': 'Rotation 2 : Next, rotate your hand 90 degrees counter clockwise around the X-axis.'}]


## 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'The X values stay the same.'}]
- [{'type': 'paragraph', 'content': 'The Maya Z value becomes the Unreal Y value.'}]
- [{'type': 'paragraph', 'content': 'The Maya Y value becomes the Unreal Z value, but you flip its sign only for rotation.'}]

- [{'type': 'paragraph', 'content': 'Maya: Uses the right-hand rule, meaning positive rotation is counter-clockwise when looking down the axis.'}]
- [{'type': 'paragraph', 'content': 'Unreal Engine: Positive rotation around X and Y are counter-clockwise, but the Z-axis is clockwise.\xa0'}]