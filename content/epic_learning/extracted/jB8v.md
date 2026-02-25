# USD UE Format Support

*Breakdown of support features and current limitations of USD format in UE*

## 


### 


#### 

- [{'type': 'paragraph', 'content': 'Different up axes: "Y" and "Z"'}]
- [{'type': 'paragraph', 'content': 'Different metersPerUnit'}]
- [{'type': 'paragraph', 'content': 'All USD native formats (usda, usdc, usd, usdz)'}]
- [{'type': 'paragraph', 'content': 'Prim purposes:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Proxy/render/guide/etc. purposes'}], [{'type': 'paragraph', 'content': 'We only traverse prims with the desired purposes when parsing'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.1:</u>\xa0 Material purposes'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'allPurpose (default), preview, full purposes'}], [{'type': 'paragraph', 'content': 'Dictate which material binding we read off prims'}]]}]
- [{'type': 'paragraph', 'content': 'Render context'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'universal, unreal, mdl, user-registered render contexts'}], [{'type': 'paragraph', 'content': 'Dictate which type of output we read off each USD material (a USD material may have a separate output for MDL, another for Unreal, etc.)'}], [{'type': 'paragraph', 'content': 'Dedicated "unreal" render context used when prims should use referenced UE material assets'}]]}]


#### 

- [{'type': 'paragraph', 'content': 'Any arbitrary transform op'}]
- [{'type': 'paragraph', 'content': 'Partial support for the "!resetXformStack!" operation'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Essentially means "treat this transform as a world transform, discarding even its parents"'}]]}]


#### 

- [{'type': 'paragraph', 'content': 'displayColor/displayOpacity support with automatically generated materials'}]
- [{'type': 'paragraph', 'content': 'Guesses the target UV index from UV set name'}]
- [{'type': 'paragraph', 'content': 'Multiple material slots specified with UsdGeomSubsets (mesh can have multiple sections)'}]
- [{'type': 'paragraph', 'content': 'Support for Mesh prims with animated mesh data via GeometryCaches'}]
- [{'type': 'paragraph', 'content': '<u>5.3:</u> Mesh with animated points are now imported as geometry caches'}]
- [{'type': 'paragraph', 'content': '<u>5.4:</u> Support for UsdPhysicsCollisionAPI (to enable mesh as collider) and UsdPhysicsMeshCollisionAPI (to specify collision shape approximation)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Support for custom collision shapes through prefixes (UBX, UCP, USP, UCX) like FBX pipeline'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0 Support for static mesh subdivision'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Subdivision level is controlled at the stage level'}], [{'type': 'paragraph', 'content': 'Subdivision can also be applied to geometry caches by enabling cvar USD.GeometryCache.EnableSubdiv'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0 Support for normals from primvar'}]


#### 

- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0 Improve support for nested skeletal data'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Each USD skeleton becomes a SkeletalMesh'}], [{'type': 'paragraph', 'content': 'Handle exporting of nested SkeletalMeshComponents to USD, and importing back the result'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0 Support USD skeletons with multiple root bones'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'A new, “true” root bone will be created and the root bones of the source data will be handled as its child bones'}]]}]
- [{'type': 'paragraph', 'content': 'Skeleton prim is converted as Skeleton'}]
- [{'type': 'paragraph', 'content': 'Mesh prims are combined into a skeletal mesh'}]
- [{'type': 'paragraph', 'content': 'Blend shape support as morph targets'}]
- [{'type': 'paragraph', 'content': 'In-between blend shapes as separate morph targets (with recomputed weights)'}]
- [{'type': 'paragraph', 'content': 'SkelAnimation'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Parsed into AnimSequence'}], [{'type': 'paragraph', 'content': 'Joint animation'}], [{'type': 'paragraph', 'content': 'Blend shape animation'}], [{'type': 'paragraph', 'content': 'Joint remapping'}]]}]
- [{'type': 'paragraph', 'content': 'Material/UV support identical as for basic Mesh prims'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Maximum of 8 joint influences per bone (engine limitation), although we also support unlimited influences if that is enabled as a project setting'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0No runtime support (no SkeletalMesh creation at runtime)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Animation of blendshapes only is not supported. Currently, animation must include joint animations'}]


#### 

- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0Support for procedurally generated primitive geometries'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Capsule, Cone, Cube, Cylinder, Plane, Sphere'}]]}]


#### 

- [{'type': 'paragraph', 'content': 'Support via predefined reference materials (displaycolor, opaque, translucent, virtual texture, translucentVT) (for runtime support)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'However, we still have an (unused and relatively incomplete) implementation of material handling by generation of material shader graphs'}], [{'type': 'paragraph', 'content': 'It’s possible to remap the reference materials used when spawning instances of each material type on the USD Importer plugin project settings'}]]}]
- [{'type': 'paragraph', 'content': 'Supported channels: BaseColor, Emissive, Metallic, Roughness, Opacity, Normal, Refraction, Occlusion'}]
- [{'type': 'paragraph', 'content': 'Textures on each channel'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'sRGB or linear textures'}], [{'type': 'paragraph', 'content': 'UDIM textures (using VT textures in Unreal)'}], [{'type': 'paragraph', 'content': 'Supports using the same texture for multiple material channels efficiently (e.g. same texture for metallic and roughness)'}], [{'type': 'paragraph', 'content': 'Support for different texture wrapping modes in USD'}]]}]
- [{'type': 'paragraph', 'content': 'PrimVar reader support for using displayColor as vertex color even with a UsdPreviewSurface material'}]
- [{'type': 'paragraph', 'content': 'MDL materials through the MDL translator'}]
- [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 Support for parsing referenced MaterialX material files via Unreal Interchange’s MaterialX translator'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Make sure to use the “.mtlx” render context when opening or importing a USD Stage with MaterialX references in order to use this feature'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 Materials can now use up to 4 simultaneous UV sets when opening or importing USD stages'}]
- [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 Support for UV transform: UsdTransform2d Shader prims are now parsed into UV transforms when parsing UsdPreviewSurface materials'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0No arbitrary shader graph support: We just handle direct binding of USD material inputs to values/textures'}]


#### 

- [{'type': 'paragraph', 'content': 'Alembic Grooms that follow the Alembic groom specification'}]
- [{'type': 'paragraph', 'content': 'Groom assets (static and baked animation) are imported from USD BasisCurves with the custom GroomAPI schema'}]
- [{'type': 'paragraph', 'content': 'Groom Caches (baked animation) and Groom tracks on LevelSequences'}]
- [{'type': 'paragraph', 'content': 'GroomBindingAPI schema allows to set up a groom on a character. This will generate a groom to bind to a skeletal mesh or geometry cache allowing the groom to animate with the mesh'}]
- [{'type': 'paragraph', 'content': 'Usage: Right-click option on the USD Stage editor to apply dedicated schema to prim to be imported as a Groom'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Not all attributes are handled in some scenarios (native USD supports only vertex positions)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Editor only since groom building is not supported at runtime'}]


#### 

- [{'type': 'paragraph', 'content': 'Becomes Hierarchical Instanced Static Mesh Components (HISM) on import'}]
- [{'type': 'paragraph', 'content': 'Handling of nested point instancers by "baking" prototypes into Static Meshes'}]
- [{'type': 'paragraph', 'content': 'Option to bake even simple PointInstancers into Static Meshes if desired (used to be an import option/UsdStageActor property, but now via the “USD.CollapseTopLevelPointInstancers” cvar)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Animations (meshes and PointInstancer attributes) are not supported'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Not all attributes are supported (e.g. Velocities, InvisibleIds, etc.)'}]


#### 

- [{'type': 'paragraph', 'content': 'Supported attributes: FocalLength, FocusDistance, FStop, HorizontalAperture, VerticalAperture, and since\xa0\n\n<u>5.6:</u>\xa0Exposure, Projection, ClippingRange'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Not all USD attributes are handled (e.g. ClippingPlanes, StereoRole, etc.)'}]


#### 

- [{'type': 'paragraph', 'content': 'Supported light types: Distant (as Directional), Dome (as SkyLight), Rect, Sphere (as PointLight), Disk (as RectLight), ShapingAPI (as SpotLight)'}]
- [{'type': 'paragraph', 'content': 'Supported attributes: Color, Intensity, Exposure, ColorTemperature, SourceAngle (for DistantLights), Width/Height (for Rect), Radius (for Disk/Sphere), ConeAngle/ConeSoftness (for ShapingAPI), TextureFile (.hdr file for Dome light)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0No support for IES light profiles'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Disk light is handled as a Rect light'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Some light types aren\'t supported (Cylinder, Mesh, etc.)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Some light APIs aren\'t fully supported (Shadow, Portal, LightFilters, etc.)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0USD is not specific with light units. We convert everything to Lumen on import when possible, but your mileage may vary'}]


#### 

- [{'type': 'paragraph', 'content': 'Supported by generating LevelSequences and tracks'}]
- [{'type': 'paragraph', 'content': 'One LevelSequence for each sublayer'}]
- [{'type': 'paragraph', 'content': 'Support for sublayer offset and scale by using subsections within the LevelSequences'}]
- [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 GeometryCache track support: they are generated by default when opening or importing stages'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Tracks are generated only for attributes that are supported by both USD and UE'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0We don\'t have any manual handling of USD value clips, although it should be handled by USD on its own in most cases'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0We only generate tracks for the strongest opinions'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0We may not support very complex sublayer setups in some cases, when they have offset/scales and different timeCodesPerSecond/framesPerSecond values'}]


#### 

- [{'type': 'paragraph', 'content': 'Can be manually placed by the user within the USD resources location to be read by USD'}]
- [{'type': 'paragraph', 'content': 'Allows user to specify additional directories on his disk to search for USD plugins'}]


#### 

- [{'type': 'paragraph', 'content': 'Leverages Unreal SparseVolumeTextures (SVTs) and the OpenVDB importer for SVTs'}]
- [{'type': 'paragraph', 'content': 'Uses the default SVT material but allows picking a different one on the project settings'}]
- [{'type': 'paragraph', 'content': 'Custom schema (SparseVolumeTextureAPI contained on the UsdResources folder) allows controlling the SVT generation, picking the selected attributes and material parameters'}]
- [{'type': 'paragraph', 'content': 'Supports volume animations by using a timeSampled filePath attribute'}]
- [{'type': 'paragraph', 'content': 'Supports basic editing of the volume animation via the Sequencer on an opened stage, and writing back the results to USD'}]


#### 

- [{'type': 'paragraph', 'content': 'Imports the audio clips as USoundWave assets'}]
- [{'type': 'paragraph', 'content': 'UAudioComponents and AAmbientSound actors are spawned on the world outliner for spatial audio functionality, but the USD attributes from the schema are primarily translated into LevelSequence audio tracks'}]
- [{'type': 'paragraph', 'content': 'On the open stage workflow, editing these audio tracks writes back out the corresponding change to USD as expected'}]


#### 

- [{'type': 'paragraph', 'content': 'Collected into AssetUserData'}]
- [{'type': 'paragraph', 'content': 'Can be edited / created from scratch in Unreal and exported to USD'}]
- [{'type': 'paragraph', 'content': 'The metadata is accessible through Python and Blueprint'}]
- [{'type': 'paragraph', 'content': 'Can be collected on all objects that allow AssetUserData, including components'}]
- [{'type': 'paragraph', 'content': 'Editing AssetUserData metadata on an asset generated with an opened USD stage writes the results back to USD'}]


#### 

- [{'type': 'paragraph', 'content': 'All alternate draw modes are supported except “fromTexture” cards'}]
- [{'type': 'paragraph', 'content': 'There’s a new USDDrawModeComponent that is spawned when a prim has alternate draw modes. Modifying its properties affects the source USD prim'}]
- [{'type': 'paragraph', 'content': 'Support for animation of the extents attributes, generating Sequencer tracks'}]
- [{'type': 'paragraph', 'content': 'There are some cvars that further control the behavior of draw modes, that all start with “USD.Bounds”'}]


#### 

- [{'type': 'paragraph', 'content': '\xa0\xa0<u class="cdx-underline">5.7:</u>\xa0 Fixed UDIM support including in MaterialX\xa0'}]
- [{'type': 'paragraph', 'content': '\xa0\xa0<code class="inline-code">Limitation:</code>\xa0No support for UsdPhysics schemas besides the collision ones\xa0\xa0'}]


### 

- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 Interchange OpenUSD plugin must be enabled to allow importing USD into the content browser\xa0\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Using the Actions -&gt; Import option on the USD Stage Editor will not go through Interchange as of yet'}], [{'type': 'paragraph', 'content': 'Using File -&gt; Import into Level will not go through Interchange as of yet'}]]}]
- [{'type': 'paragraph', 'content': 'The cvar “Interchange.FeatureFlags.Import.USD” can be set to false while keeping the Interchange OpenUSD plugin enabled to force the USD import to go through the legacy USD importer.'}]
- [{'type': 'paragraph', 'content': 'Still at an experimental level.'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Preliminary support for static meshes, skeletal meshes and morph targets, materials (including MaterialX), textures, skeletal animation (UAnimSequences), lights, cameras and LevelSequence animation'}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 Preliminary support'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Sparse volume textures from OpenVDB'}], [{'type': 'paragraph', 'content': 'Internal/embedded MaterialX'}], [{'type': 'paragraph', 'content': 'Collisions on static meshes'}], [{'type': 'paragraph', 'content': 'Geometry caches\xa0(with animated transforms in <u class="cdx-underline">5.7</u>)'}]]}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 It is possible to pick whether to group imported assets into folders for each asset type, or whether to create an additional folder for the import as a whole'}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 There are new USD Translator settings to allow converting simple USD attributes into Interchange custom user attributes on its translated nodes, possibly filtering via regular expressions'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u> Support'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Groom assets and groom caches'}], [{'type': 'paragraph', 'content': 'Static and skeletal Nanite mesh assemblies'}], [{'type': 'paragraph', 'content': 'Support for importing dome light as sky light'}], [{'type': 'paragraph', 'content': 'Partial support for SpatialAudio prims'}], [{'type': 'paragraph', 'content': 'Support for instanceables'}]]}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Support for subdividing meshes at import'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Prim metadata can now collected on imported assets and actors as metadata'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Legacy Nanite triangle threshold now supported in Interchange'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Support for parsing MaterialX materials embedded in USD'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Added support for parsing PointInstancer prims as Instanced Static Mesh Components'}]

- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0\n\nFixed UDIM support including in MaterialX'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0No support for UsdPhysics schemas besides the collision ones'}]


### 

- [{'type': 'paragraph', 'content': 'Property changes on spawned actors and components are immediately written to the USD stage (for properties that have an equivalent in USD)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Support for tracking assignment of material overrides on static and skeletal meshes'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Modification of any generated UE asset does not write back to the USD stage'}]]}]
- [{'type': 'paragraph', 'content': 'Notices emitted by the USD stage while it is opened (i.e. after prim/stage changes) will be used for automatically refreshing actors and assets when needed'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Even changes triggered via Python cause UE level/asset updates instantly'}], [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 The USD Stage Actor can automatically regenerate its transient assets whenever any prim relevant for their generation are modified, which includes but is not restricted to Material prims and their Shaders'}]]}]
- [{'type': 'paragraph', 'content': 'USD Stage Editor window allows visualizing and manipulating the USD prim hierarchy, layer hierarchy and prim properties'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Allows an increasing number of operations like creating/copy/paste/cut/duplicating prims, adding/removing references and payloads, adding/removing/reorganizing layers, etc.'}], [{'type': 'paragraph', 'content': 'Allows interacting with the AUsdStageActor’s properties and switching the purposes to render, material render context, collapsing rules, etc. via the Options menu'}], [{'type': 'paragraph', 'content': 'Allows quickly switching to different AUsdStageActors via the dropdown menu on the top-right of the window. Alternatively, AUsdStageActors have a button on their details panel to automatically attach to and display the USD Stage Editor window'}], [{'type': 'paragraph', 'content': 'Allows some export options that can be useful when manipulating USD Stages (exporting flattened stages, or just all layers of a stage to a new folder)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 The File -&gt; Export menu now contains an option to export a “flattened layer stack”, which is a mode of flattening that collapses the local layer stack, but preserves payloads and reference composition arcs'}]]}], [{'type': 'paragraph', 'content': 'Allows toggling of USD variants within variant sets'}], [{'type': 'paragraph', 'content': 'It’s possible to interact directly with the USD Stage Editor window via scripting (and Editor Utility Blueprints) by using the UsdStageEditorLibrary'}], [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 The USD Stage Editor’s right panel allows visualizing and editing USD prim relationships, metadata and attribute metadata as well as regular prim attributes'}], [{'type': 'paragraph', 'content': 'Payloads'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Toggling payloads on/off'}], [{'type': 'paragraph', 'content': 'Opening the stage with all payloads on/off (initial load set)'}]]}]]}]
- [{'type': 'paragraph', 'content': 'USD provides a "stage cache" that can be used to retrieve and interact with the same stage from Python and C++. We always use this cache when opening the stage via an AUsdStageActor'}]
- [{'type': 'paragraph', 'content': 'The UsdAssetCache asset type is assigned to AUsdStageActors, and caches the Unreal assets generated from prims'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 A new version of the UsdAssetCache (UsdAssetCache3) has been implemented, and is now used by all USD Stage Actors'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Unlike the previous USD Asset Caches, this version exposes the assets it has cached as regular assets on the content browser, which allows them to be modified, moved or cooked, and still be tracked and reused when opening stages. The folder where these assets are kept (and the actual asset mapping itself) can be edited on the asset cache’s details panel (i.e. by double-clicking on the Asset Cache itself)'}]]}], [{'type': 'paragraph', 'content': 'The cache can be shared between different AUsdStageActors to share the assets between them when possible'}], [{'type': 'paragraph', 'content': 'Double-clicking on the UsdAssetCache asset itself opens an editor with a couple of properties that configure how the cache behaves. <i>It’s possible to have the cache retain reference to unused assets, and to even persist some Unreal asset types to disk (removed <u>5.5</u>)</i>'}], [{'type': 'paragraph', 'content': '<i>The UsdAssetCache can now persist StaticMeshes, SkeletalMeshes, Skeletons, PhysicsAssets and Materials to disk, in addition to Textures (new in <u>5.3</u>/removed in <u>5.5</u>)</i>'}], [{'type': 'paragraph', 'content': 'The UsdAssetCache is fully exposed to Blueprint and Python scripting'}], [{'type': 'paragraph', 'content': 'A default asset cache is created for the Unreal project and reused by USD Stage Actors whenever they are not set with one manually. The default asset cache can be set on the Unreal Project Settings'}]]}]
- [{'type': 'paragraph', 'content': 'Opened stage can be reloaded (layers are re-read from disk) and Reset (session layer and stage session is discarded, but layers are kept loaded)'}]
- [{'type': 'paragraph', 'content': 'Animation support in real time'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Support for both USD animation curve interpolation modes: Held (constant) and Linear'}], [{'type': 'paragraph', 'content': 'Two different strategies for supporting USD animations:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'A "Time" property track for the AUsdStageActor that resamples the USD stage/animates the spawned components at any given moment in time. A good approach for playing USD Stage animation from a separate, persistent LevelSequence is to bind the AUsdStageActor and animate this property'}], [{'type': 'paragraph', 'content': 'Automatic generation of a stage LevelSequence when the stage is opened, creating tracks for all animated properties'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Modifications to these tracks automatically write out updated animation time samples to USD'}], [{'type': 'paragraph', 'content': 'Support for creating new bindings by dragging spawned actors onto the generated LevelSequence'}]]}], [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0 The USD Importer leverages the new “Dynamic Bindings” feature from the Sequencer, so that the transient actors and components generated when opening a USD Stage can be bound to a persistent LevelSequence, and those bindings will persist whether you Reload or Close the USD Stage'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 The usage of the Dynamic Binding mechanism was replaced with the usage of the Sequencer’s Universal Object Locator system (UOL). It should provide the same functionality, but be much more robust and performant for the USD use case'}]]}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Some types of animation are only supported in one of the strategies'}]]}]]}]
- [{'type': 'paragraph', 'content': '<u>5.4:</u>\xa0 Stage state option'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'A new “Stage State” option lets you control how a USD stage is handled on the USD stage actor. The stage state setting is accessible in Sequencer so it can be used to control the state of the stage from a LevelSequence'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Closed: The USD stage will not be opened in the USD stage editor, regardless of what the RootLayer property is set to. No assets, actors or components are spawned'}], [{'type': 'paragraph', 'content': 'Opened: The USD stage is opened in the USD stage editor so the prim hierarchy and their attributes can be inspected. No assets, actors or components are spawned'}], [{'type': 'paragraph', 'content': 'OpenedAndLoaded: The USD stage is opened in the USD stage editor, and assets, actors and components are spawned'}]]}]]}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Sublayers can be muted and reloaded individually'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Can export to all native USD formats except USDZ;'}]


#### 

- [{'type': 'paragraph', 'content': 'LOD support:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Possible to set the range of LODs to export'}], [{'type': 'paragraph', 'content': 'Exported as a Variant Set configuration'}]]}]
- [{'type': 'paragraph', 'content': 'Possible to bake the used materials'}]
- [{'type': 'paragraph', 'content': 'Possible to use a dedicated "payload" file to contain the raw mesh data'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Export option to export the source mesh data instead of the render data, which can be useful for Nanite meshes'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 All mesh exports will export “extents” to USD'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Static mesh exports to USD describe whether Nanite was originally enabled for the mesh. If that was the case, reimporting the mesh back into Unreal will automatically re-enable Nanite for it. This works even when the static mesh has multiple LODs'}]


#### 

- [{'type': 'paragraph', 'content': 'Always baked into textures or single values directly written to the material (when possible)'}]
- [{'type': 'paragraph', 'content': 'Supported channels: BaseColor, Specular, Metallic, Roughness, Normal, Tangent, EmissiveColor, Opacity/OpacityMask, Anisotropy, AmbientOcclusion, SubsurfaceColor'}]
- [{'type': 'paragraph', 'content': 'Possible to configure the material channels to bake into'}]
- [{'type': 'paragraph', 'content': 'Possible to configure resolution for all channels in batch, or on a channel by channel basis'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Some of the supported channels aren\'t officially supported by USD (and aren\'t read back on import from USD either)'}]


#### 

- [{'type': 'paragraph', 'content': 'Morph targets exported as BlendShapes'}]
- [{'type': 'paragraph', 'content': 'LOD support like for StaticMesh'}]
- [{'type': 'paragraph', 'content': 'Possible to bake the used materials'}]
- [{'type': 'paragraph', 'content': 'Possible to use a dedicated "payload" file to contain the raw mesh data'}]


#### 

- [{'type': 'paragraph', 'content': 'Joint animation and morph target curves'}]
- [{'type': 'paragraph', 'content': 'Possible to export the preview Skeletal Mesh alongside the animation'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Option to export these skeletal animations as GeometryCaches (unskinned Mesh prims with animated points and topology)'}]


#### 

- [{'type': 'paragraph', 'content': 'Python based exporter, which can easily be tweaked when needed. All other exporters are C++based'}]
- [{'type': 'paragraph', 'content': 'Baking of TextureCube assets into .hdr textures when needed'}]
- [{'type': 'paragraph', 'content': 'Option to export a dedicated USD layer for each sublevel, or a single combined layer'}]
- [{'type': 'paragraph', 'content': 'Material overrides are emitted to a dedicated MaterialOverrides.usda layer'}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 Option to pick the root prim name'}]
- [{'type': 'paragraph', 'content': 'HISM components'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Exported as PointInstancer components'}]]}]
- [{'type': 'paragraph', 'content': 'Landscapes'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Baked as Static Meshes'}], [{'type': 'paragraph', 'content': 'Possible to configure a range of LOD levels to export. Those are handled with Variant Sets on the USD side'}], [{'type': 'paragraph', 'content': 'Landscape materials are also automatically baked'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0There is a landscape material baking issue which will sometimes generate incorrect texture maps. Exporting the same scene once again usually corrects this problem'}]]}]
- [{'type': 'paragraph', 'content': 'Foliage'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Also exported as PointInstancer components'}], [{'type': 'paragraph', 'content': 'Export option to pick between placing foliage on the sublayer that owns the component they were placed on, or the sublayer that owns the foliage actor they belonged to within UE'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Current issues when exporting on levels where World Partition is used'}]]}]
- [{'type': 'paragraph', 'content': 'Lights'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0No support for IES light profiles'}]]}]


#### 

- [{'type': 'paragraph', 'content': 'Tracks are played in the background and fully baked into timeSamples, which immediately supports any Sequencer feature like blending/transitions/etc.'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 The export will not emit timeSamples to USD unless necessary (e.g. during parts of the Sequence without animation, or for properties without any animation). This behaviour can be disabled by setting the cvar “USD.LevelSequenceExport.SkipConstantValues” to false'}]
- [{'type': 'paragraph', 'content': 'Complex SubSequence configurations are always baked into single standalone USD layers'}]
- [{'type': 'paragraph', 'content': 'Exported to a layer that only contains animation, and is meant to be composed with the layers exported for the corresponding level (can do that automatically as an export option)'}]
- [{'type': 'paragraph', 'content': 'Support for Spawnables by using USD visibility as a substitute for the spawn track'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u> Export of audio tracks into UsdMediaSpatial audio schema prims'}]
- [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0 Export of CameraRig_Rail animation to USD'}]


#### 


#### 


#### 


#### 


### 

- [{'type': 'paragraph', 'content': 'Custom translators'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Each USD schema type we support has a particular C++ class called a “translator”, that converts that prim into UE assets, actors and components'}], [{'type': 'paragraph', 'content': 'Users can implement their own custom translators for any USD schema type, extending/overriding our functionality when needed'}]]}]
- [{'type': 'paragraph', 'content': 'Support for having Blueprint actors that derive from the AUsdStageActor, behaving sensibly when e.g. Blueprint is recompiled, or multiple instances of it placed on the level'}]
- [{'type': 'paragraph', 'content': 'Partial support for the "Open stage workflow" at runtime'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Even at runtime, the AUsdStageActor can be used to spawn transient assets, actors and components from a USD file on disk'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Some asset types like SkeletalMeshes, Grooms/GroomCaches, LevelSequences or MDL materials can\'t be generated at runtime'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0USD runtime supported on Windows only, not Linux nor Mac'}]]}]
- [{'type': 'paragraph', 'content': 'Parsing of transform animations on SkelRoots or Skeletons as AnimSequence root motion'}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 An Unreal specific attribute "UnrealNanite" can be used to toggle Nanite generation on a mesh prim regardless of triangle threshold\xa0<i>Nanite manual toggle for generated StaticMeshes on a per-prim basis (removed in <u>5.6</u>)</i>'}]
- [{'type': 'paragraph', 'content': 'Nanite automatic threshold for generated StaticMeshes after a specific number of triangles'}]
- [{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0 Fallback Collision Type option on “Open stage workflow” and “Import workflow”, which allows specifying the type of collision for static meshes when nothing collision-related is authored on the USD prim'}]
- [{'type': 'paragraph', 'content': 'Reimport'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Storage of source prim and layer on UE asset import data, supporting reimport on each asset'}]]}]
- [{'type': 'paragraph', 'content': 'Collapsing'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Combining of multiple prims into a single asset/component (e.g. many Mesh prims becoming a single StaticMesh or a SkelRoot and its hierarchy of Mesh prims becoming a single SkeletalMesh)'}], [{'type': 'paragraph', 'content': 'Usage of prim "kinds" to determine what should be collapsed or not'}], [{'type': 'paragraph', 'content': 'Option to merge identical material slots when collapsing, or keep them all separate'}], [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0A new codeless schema called “CollapsingAPI” has been described on the ‘unreal’ USD plugin (Engine\\Binaries\\ThirdParty\\USD\\UsdResources\\Win64\\plugins\\unreal\\resources\\unreal\\schema.usda). This schema can be added to any prim, and allows explicit control of whether a prim should collapse or not. The opinion of this schema overrides any collapsing behavior dictated by prim kind'}], [{'type': 'paragraph', 'content': '<u>5.5:</u>\xa0A new option has been added to the USD Stage Editor collapsing menu (and as a USD Stage Actor property) that lets the usage of prim kinds for collapsing be itself explicitly turned off. The combination of this option and the new CollapsingAPI schema allows full control of which parts of the stage should collapse'}]]}]
- [{'type': 'paragraph', 'content': 'Support for having root USD layer paths relative to the UE project folder'}]
- [{'type': 'paragraph', 'content': 'Open stage workflow:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Caching of generated assets by hash of the source prim\'s attributes for better performance (<i>removed in\xa0<u class="cdx-underline">5.5</u></i>)'}], [{'type': 'paragraph', 'content': 'Persistent cache of textures (<i>removed in\xa0<u class="cdx-underline">5.5</u></i>)'}], [{'type': 'paragraph', 'content': 'Possible to save an AUsdStageActor with a loaded USD file ready on the UE level, and the USD stage will be loaded on demand when the level is loaded (even on scenarios like MovieRenderQueue)'}], [{'type': 'paragraph', 'content': 'Proper behavior when going into PIE: Assets and components are efficiently duplicated, and modifications performed during PIE are not written to the USD stage like they are during the editor'}], [{'type': 'paragraph', 'content': 'Partial support for undo/redo on the changes caused on the UE level/assets as well as on the USD stage'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Many operations not undoable: Adding/removing layers, deleting prims, deleting attributes, etc.'}]]}], [{'type': 'paragraph', 'content': 'Partial support for UE editor MultiUser:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'AUsdStageActor synchronizes when a stage is opened or closed or animated (via the generated LevelSequence)'}], [{'type': 'paragraph', 'content': 'Partial support for synchronizing changes to the spawned UE actors and components, and changes that affect the USD stage'}], [{'type': 'paragraph', 'content': '<code class="inline-code">Limitation:</code>\xa0Analogous to the undo/redo support (same functionality is used under the hood) many operations are not synchronized properly'}]]}], [{'type': 'paragraph', 'content': 'Integration with ControlRig for quickly editing a SkelAnimation prim in UE and writing the modified animation back out to USD in real time'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Usage of a persistent ControlRig asset'}], [{'type': 'paragraph', 'content': 'Relationship between prim and ControlRig is stored on the actual USD layers on disk, and re-established automatically when the stage is reopened'}]]}], [{'type': 'paragraph', 'content': 'Integration with Live Link for animating the skeletal and non skeletal UE actors spawned when opening a USD stage'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Relationship between prim and Live Link source is stored on the actual USD layers on disk, and re-established automatically when the stage is reopened'}]]}], [{'type': 'paragraph', 'content': '<u>5.3:</u>\xa0The USD Importer leverages the new “Dynamic Bindings” feature from the Sequencer, so that the transient actors and components generated when opening a USD Stage can be bound to a persistent LevelSequence, and those bindings will persist whether you Reload or Close the USD Stage'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<u class="cdx-underline">5.5:</u>\xa0the usage of the Dynamic Binding mechanism was replaced with the usage of the Sequencer’s Universal Object Locator system (UOL). It should provide the same functionality, but be much more robust and performant for the USD use case'}]]}]]}]
- [{'type': 'paragraph', 'content': 'VariantSet setup for automatic LOD generation'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<u>5.6:</u>\xa0The option to merge identical material slots also affects static and skeletal meshes generated with multiple LODs'}]]}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.4:</u>\xa0New stage option “Reuse Identical Assets” to force creating separate assets'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'By default, the USD importer will try to reuse the same asset for different prims if it turns out they are actually the same data. Disabling this new option will create a new asset for each prim'}], [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.5:</u>\xa0“Reuse Identical Assets” was renamed to “Share Assets for Identical Prims”'}]]}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.4:</u>\xa0\xa0Cvars USD.StaticMesh.BuildSettings and USD.Nanite.Settings to control some of the static mesh build and Nanite settings'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.5:</u>\xa0Option to disable the logging of error and diagnostic messages from the USD SDK (TfDiagnosticMgr)'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.6:</u>\xa0Custom LodSubtreeAPI schema to encode LODs similarly to FBX LOD Group'}]
- [{'type': 'paragraph', 'content': '<u class="cdx-underline">5.7:</u>\xa0Custom SubdivisionAPI schema to control subdivision level per-prim'}]