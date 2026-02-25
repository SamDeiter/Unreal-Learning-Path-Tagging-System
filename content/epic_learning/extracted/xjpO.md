# Panel Cloth Editor Updates (5.5)

*The Beta Chaos Cloth Panel Editor in 5.5 features some new updates, quality of life improvements and lots of bug fixes. This document will provide an overview of some of those 5.5 changes as we refactor the Panel Cloth Editor to work more cohesively with Dataflow (including Flesh, Hair and Destruction) in the future.*

### 


### 


### 



### 


### 


### 


### 


### 


#### 


### 


### 


#### 

- [{'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<b>Cloth Asset and Legacy Cloth:</b> Added concept of Inner and Outer Lift and Drag. This allows setting different lift and drag coefficients for when air is hitting the front face vs backface of the cloth. * Cloth Asset only: Added ability to specify WindVelocity in different spaces rather than just world space.'}]]}]

- [{'type': 'paragraph', 'content': 'Legacy Chaos Cloth: add FlatnessRatio to the config.'}]


#### 

- [{'type': 'paragraph', 'content': "<b>Chaos Cloth visualization updates.</b> * Fix cloth debug draw to display when PIE is paused. This was just a matter of switching to not draw in Foreground since the Foreground Linebatcher queue flushes every frame, even when paused. * Add an option to draw in foreground or in the world via cvar (p.ChaosClothVisualization.DrawInForeground) * Enable all text-based debug draw in PIE/outside of asset editors (doesn't work when paused, but it's a start). * Update Draw Local Space to show the name of the reference bones."}]
- [{'type': 'paragraph', 'content': '<b>Chaos Cloth:</b> Added Velocity and Acceleration clamps. Similar to RBAN, the clamps are applied after the scaling. (see above)'}]
- [{'type': 'paragraph', 'content': 'Enabled debug display of bones for follower skinned asset components (e.g., typical chaos cloth asset usage).'}]
- [{'type': 'paragraph', 'content': 'Added ChaosClothAsset to Cloth Total cycle stat.'}]
- [{'type': 'paragraph', 'content': '<b>Chaos Cloth Asset:</b> Added the ability to specify Velocity Scale and clamps in different simulation spaces (defaults to Reference Bone space, which was the previous behavior).'}]
- [{'type': 'paragraph', 'content': 'Added the ability to <b>Show/Hide pins in Dataflow</b> and set many existing Chaos Cloth Asset dataflow nodes to hide inputs by default. (see above)'}]
- [{'type': 'paragraph', 'content': 'Added <b>weight map support</b> to Buckling Ratio on Chaos Cloth Assets.'}]
- [{'type': 'paragraph', 'content': 'Made improvements to the Chaos Cloth Asset Selection Node and tool to match behavior with the Weight Map Node.'}]


#### 

- [{'type': 'paragraph', 'content': "Exposed the Skeletal Mesh Component's ClothTeleportMode property to Sequencer and added a new HardReset mode which rebuilds the cloths."}]
- [{'type': 'paragraph', 'content': "Make the Skeletal Mesh Component's ClothCollisionSource methods BlueprintCallable."}]
- [{'type': 'paragraph', 'content': '<b>Chaos Cloth Component simulations</b> can now be modified from blueprints via the UChaosClothAssetInteractor.'}]


#### 

- [{'type': 'paragraph', 'content': 'Cloth Editor and Dataflow Editor: allow tools to start when PIE is running'}]
- [{'type': 'paragraph', 'content': 'Cloth Editor: Remove secondary selection from Selection Tool. Allow importing secondary selection from input collection, to allow safe data migration.'}]
- [{'type': 'paragraph', 'content': "Cloth Editor: when clicking on a WeightMap node to start the Paint tool, change the construction viewport view mode to the appropriate Sim/Render mode based on the node's MeshTarget value. Don't allow changing between Render and Sim modes while the tool is active (but do allow changing 2D/3D if we are in Sim mode) (see above)"}]
- [{'type': 'paragraph', 'content': 'Cloth Editor: roll back previous change disabling fly mode camera in both viewports. Add a Click-Drag behavior that will prevent camera movement when left-mouse dragging but allow everything else'}]
- [{'type': 'paragraph', 'content': "Cloth Editor Preview: when reloading or changing the SkeletalMeshAsset, save and restore the animation state so that it doesn't always start playing from time zero"}]
- [{'type': 'paragraph', 'content': 'Cloth Editor: add ability to visualize surface normals in the construction viewport'}]
- [{'type': 'paragraph', 'content': 'Cloth Editor: add a new "WeightMap Node" that will supersede AddWeightMapNode. Deprecate the old AddWeightMapNode. The new Node has only one set of vertex weights rather than two. The deprecated AddWeightMapNode still works in the graph but its properties cannot be edited and is no longer linked to the Weight Map Paint Tool. Users should migrate their weight map data out of the AddWeightMap nodes and into WeightMap nodes. (see above)'}]
- [{'type': 'paragraph', 'content': 'Added grow, shrink, and flood buttons to the Selection Tool'}]


#### 

- [{'type': 'paragraph', 'content': 'Cloth weight paint tool: draw 0.0 weight values as blue, 1.0 weight values as yellow. Make this behavior toggle-able with a checkbox in the UI.'}]
- [{'type': 'paragraph', 'content': 'Cloth weight map paint tool: make changes to the weight map node undoable'}]


#### 

- [{'type': 'paragraph', 'content': 'Remesher: add an optional edge length scale function that can be used for adaptive-density remeshing'}]
- [{'type': 'paragraph', 'content': "Cloth Editor Remesh Node: Add a Simplify option for Render mesh decimation. When enabled, this will use FSimplifyMeshOp rather than FRemeshMeshOp. The Simplifier uses QEM to prioritize removing vertices in flat areas to preserve curvature. The result is typically a lower poly count but less uniform mesh than FRemeshOp produces. Because of this, it's only enabled for the Render mesh."}]
- [{'type': 'paragraph', 'content': 'Cloth Editor Remesher: better handling of open meshes in the Render mesh. Add the option to detect connected boundary vertices that are coincident with another connected set of boundary vertices on another boundary elsewhere. We can then explicitly remesh these "seams" while maintaining a vertex pairing, before then going on to remesh the interior of the mesh islands.'}]


### 

- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Ensure AnimatedNormals and normals are initialized and updated correctly when LOD switching Chaos Cloth.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix:</b> Fixed normal calculation/import when creating Chaos Cloth Assets so they're no longer flipped."}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fixed a bookkeeping bug where External Collisions would not be added and removed correctly with the Chaos Cloth Asset.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fixed a bug where the Chaos Cloth Simulation would continue to run when EnableSimulation was set to false on the component.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Dataflow and Cloth Asset Editors: make undo/redo work when changing node property values.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix: </b>Update Dataflow Node Details panel to handle showing multiple selected nodes.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fix an issue with how Long Range Attachments were calculated in the Chaos Cloth Asset using improperly scaled Max Distance maps.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix:</b> Dataflow Editor: when user presses 'F' while a tool is running, use that tool's focus box to orient the camera, if it has one defined"}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fixed a bug where Fictitious Angular Scale would apply a force when teleporting Cloth (both Skeletal Mesh-based cloth and new Chaos Cloth Asset panel cloth).'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Dataflow Editor: delay loading the editor module to PostDefault to allow other modules to register their nodes, tools, and view modes. Warn if trying to register tools and view modes after editor commands have already been set up.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: when nothing is selected in the preview scene, disable the numeric transform inputs.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor Weight Map Paint Tool: Smooth brush improvements: - consider a wider neighborhood of vertices when computing average values - added a falloff function.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: make Selection node changes via the tool undoable, similar to previous change to the Weight Map Paint tool. Also make the previously-added FWeightMapNodeChange a nested class inside FChaosClothAssetAddWeightMapNode.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: when selecting a node for the first time, focus the construction viewport to capture the dynamic mesh.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix: </b>Cloth Editor: don't store the animation instance in the Preview scene, just allow the SkeletMeshComponent to keep track of it. This fixes a problem where the animation playback controls don't respond after reloading the SkeletalMesh asset in the preview scene. When a SkelMeshComponent is re-registered (e.g. after the asset is reloaded), it unconditionally destroys and re-creates its AnimScriptInstance, so we're guaranteed to be holding onto the wrong object in the editor if we are tracking it ourselves."}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: when clicking a node for the first time start any corresponding tool immediately. This change just creates the DynamicMeshComponent before trying to start the tool. Also: clear the bDynamicMeshComponentInitDeferred flag after testing it in the Tick function, not inside ReinitializeDynamicMeshComponents(), to prevent unexpected behavior calling ReinitializeDynamicMeshComponents out of sequence.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: fix for the mesh in the construction viewport not updating when node properties in the details panel are changed.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix: </b>Fix a check that occurs when clicking a node after doing "Save As" in the Cloth Editor.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix: </b>Cloth Editor Preview: save and load animation state when reimporting skeletal mesh. Previously this happened only when reloading the asset, not reimporting.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: fix crash when reloading Dataflow asset.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix</b>: Cloth Selection Node: allow selection nodes to remove elements from an existing selection, rather than just add to it.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix:</b> Cloth Editor: focus on tool-defined selection box when user hits 'F', not the entire cloth object."}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor Selection Tool: request graph evaluation when leaving selection tool.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor Remesh Node: fix crash when collection has invalid stitches.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor paint tool: allow brush to get super small. Also fix brush circle not updating after manually setting the brush size property.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: fix crash when changing Dataflow property. We were not passing in a null DataflowEditor when reinitializing the graph editor.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix:</b> Cloth Editor: don't start the preview animation any time anything changes in the graph."}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Editor: Empty Tabs bug fixed!'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix: </b>Fix typo: OnPreReimport -&gt; OnPostReimport. Fixes a crash when reimporting SkelMesh after the Cloth Editor is closed.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fix crash when closing cloth editor while selection tool is running.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fix crash when right clicking a comment node in DataflowGraphEditor.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix: </b>Fix crash when deleting selection node while selection tool is active.'}]
- [{'type': 'paragraph', 'content': "<b>Bug Fix:</b> Cloth Asset Builder: don't assert if there is not one material per render pattern in the asset, just log a warning. Even though each pattern has a material in the ClothCollection, the user can still remove materials from the asset after the graph evaluates, which can cause this assert to fire when the asset is subsequently loaded."}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth Selection Node: check that selection indices are valid for the associated group before adding to the collection.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Cloth selection tool: fix back face material checkerboard.'}]
- [{'type': 'paragraph', 'content': '<b>Bug Fix:</b> Fix material index mapping when turning multiple cloth collections into LODs for one asset.'}]