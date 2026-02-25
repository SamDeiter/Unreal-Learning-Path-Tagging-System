# Performance Tips & Tricks - Animation

*Peformance tips and tricks for Skeletal Mesh and Animation Blueprint*

## 


## 


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Merge in DCC -\xa0 if you don’t need to switch mesh parts dynamically, you are better off merging them in a DCC tool.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine#skeletalmeshmerge">Skeletal Mesh Merge API</a>—Use the FSkeletalMeshMerge API for runtime merging in packaged projects.\xa0 Note that this functionality runs on the game thread, so it can cause hitches, but it will reduce perf costs after the merge.\xa0 Morph targets are also not currently supported.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/mutable-overview-in-unreal-engine">Mutable</a> - Merge skeletal mesh components either in the editor, to create new assets, or at runtime, asynchronously, to generate meshes dynamically.'}]


#### 


## 


## 


### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/root-motion-in-unreal-engine#animationblueprint">Root Motion From Everything</a> is used when a Character Movement Component is present.\xa0 This forces the animation update onto the game thread.\xa0 Instead, you can now use AttributeBasedRootMotionComponent (see the <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine">Motion Warping plugin</a>), which applies the last frame’s root motion data to the current frame.\xa0\xa0We recommend putting the component into velocity mode to avoid jitter due to the frame delay.'}]
- [{'type': 'paragraph', 'content': 'Using a non-thread safe anim node anywhere in your anim graph - all anim nodes shipped by Epic are thread safe.'}]
- [{'type': 'paragraph', 'content': 'Calling a non-thread safe function from within the anim graph.\xa0 If you do this, you should see a warning when you compile your anim blueprint.\xa0\xa0Property access-based calls remain safe, as they are automatically run prior to the animation update and cached when required.'}]
- [{'type': 'paragraph', 'content': 'The initial animation update will run on the game thread if the Tick Animation On Skeletal Mesh Init property is set (see below)'}]


### 


### 

- [{'type': 'paragraph', 'content': '<b>Always Tick Pose And Refresh Bones</b> - the anim graph is always updated and evaluated, even when the mesh is offscreen.'}]
- [{'type': 'paragraph', 'content': '<b>Always Tick Pose</b> - the anim graph is always updated but only evaluated to generate a pose when the mesh is onscreen.'}]
- [{'type': 'paragraph', 'content': '<b>Only Tick Pose When Rendered</b> - the anim graph is updated and evaluated only when the mesh is onscreen.'}]
- [{'type': 'paragraph', 'content': '<b>Only Tick Montages And Refresh Bones When Playing Montages</b> - when the mesh is offscreen, the anim graph will only be updated and evaluated when a montage is active.'}]
- [{'type': 'paragraph', 'content': '<b>Only Tick Montages When Not Rendered</b> - when a mesh is offscreen, the anim graph will only be updated when a montage is active.'}]


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


### 

- [{'type': 'paragraph', 'content': '<b>Deferred Simulation -</b>\xa0each simulation runs on a worker thread, with results applied next frame. This is particularly useful for chains of RBANs, avoiding waiting for sequential simulation. The downside is that the transforms are a frame out of date.'}, {'type': 'image', 'image_id': 66578, 'caption': '', 'alt_text': '', 'image': {'id': 66578, 'file_name': 'image.png', 'file_size': 20483, 'content_type': 'image/png', 'created_at': '2025-03-28T22:32:40.312+00:00', 'height': 280, 'width': 529, 'storage_key': 'eed13252-3c6b-4995-a3b7-2770fc32d0e7', 'context': 'learning'}, 'storage_key': 'eed13252-3c6b-4995-a3b7-2770fc32d0e7', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'There are also solver settings for RBAN that can be set directly within the Physics Asset'}, {'type': 'image', 'image_id': 66581, 'caption': '', 'alt_text': '', 'image': {'id': 66581, 'file_name': 'image.png', 'file_size': 30209, 'content_type': 'image/png', 'created_at': '2025-03-28T22:35:44.958+00:00', 'height': 489, 'width': 642, 'storage_key': 'ccbf1a47-b0b0-4685-981e-7148dfd80c1a', 'context': 'learning'}, 'storage_key': 'ccbf1a47-b0b0-4685-981e-7148dfd80c1a', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Reducing the iteration count will make the simulation cheaper. '}]
- [{'type': 'paragraph', 'content': 'If collisions aren’t required, disable them'}]
- [{'type': 'paragraph', 'content': "If limits aren't required, disable them"}]


### 


#### 


#### 


### 


### 


#### 


### 


## 


### 


### 


###