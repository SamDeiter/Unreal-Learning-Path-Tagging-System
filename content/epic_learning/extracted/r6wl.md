# World Building Guide

*This guide provides per-feature definitions, subjects to master, good practices and pitfalls, limitations, use cases specific to world building with Unreal Engine's World Partition system.*

## 


##### 


## 


## 


## 


### 


#### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<b>Streaming Performance Improvements</b>'}, {'type': 'paragraph', 'content': 'Improved overall engine performance when streaming in/out content of the world at runtime to address long-standing issues with physics state creation/destruction, add to world/remove from world and much more (see below).'}, {'type': 'image', 'image_id': 69371, 'caption': '', 'alt_text': '', 'image': {'id': 69371, 'file_name': 'image29.gif', 'file_size': 2778011, 'content_type': 'image/gif', 'created_at': '2025-05-29T21:47:55.025+00:00', 'height': 270, 'width': 480, 'storage_key': '88df526c-8dcc-4b1f-a27b-c770e3c6ed82', 'context': 'learning'}, 'storage_key': '88df526c-8dcc-4b1f-a27b-c770e3c6ed82', 'context': 'learning', 'width': None, 'autoplay': True}, {'type': 'paragraph', 'content': 'The list of core improvements below applies for every project and can be combined with the FastGeo Streaming plugin that addresses immutable static geometry.\xa0 <u class="cdx-underline">As these are considered experimental for 5.6, most need to be enabled and tested thoroughly in each project.\xa0</u>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>UpdateStreamingState</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Asynchronous UWorldPartitionStreamingPolicy::UpdateStreamingState'}, {'type': 'paragraph', 'content': '<code class="inline-code">wp.runtime.UpdateStreaming.EnableAsyncUpdate = true</code>'}], [{'type': 'paragraph', 'content': 'UWorld::InternalUpdateStreamingState optimization which removes un-necessary calls'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Asynchronous physics state creation/destruction</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Asynchronous physics state creation (InitBody) and destruction'}, {'type': 'paragraph', 'content': '<code class="inline-code">p.Chaos.EnableAsyncInitBody = true</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code"> LevelStreaming.AllowIncrementalPreRegisterComponents = true</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AllowIncrementalPreUnregisterComponents = true</code>'}], [{'type': 'paragraph', 'content': 'Asynchronous Landscape Heightfield Collision Component physics state creation'}, {'type': 'paragraph', 'content': '<code class="inline-code">p.Chaos.EnableAsyncInitBody = true</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AllowIncrementalPreRegisterComponents = true</code>'}], [{'type': 'paragraph', 'content': 'Asynchronous physics state creation & destruction improvements including support to set a maximum time budget per frame for the asynchronous task using <code class="inline-code">p.Chaos.AsyncPhysicsStateTask.TimeBudgetMS\xa0</code>no limit by default).'}, {'type': 'paragraph', 'content': 'The latter allows balance and throttle the asynchronous physics state creation/destruction for Chaos to keep up with everything'}], [{'type': 'paragraph', 'content': 'Multiple AddToWorld/RemoveFromWorld, used to maximize the time limit allowed for AddToWorld and RemoveFromWorld when asynchronous physics state creation and destruction are used.'}, {'type': 'paragraph', 'content': 'Requires:\xa0<code class="inline-code">p.Chaos.EnableAsyncInitBody = true</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AllowIncrementalPreRegisterComponents = true</code>'}, {'type': 'paragraph', 'content': 'AND/OR<code class="inline-code">\xa0LevelStreaming.AllowIncrementalPreUnregisterComponents = true</code>'}, {'type': 'paragraph', 'content': 'To enable in level streaming:\xa0'}, {'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.MaximumMakingVisibleLevels = &lt;value&gt;</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.MaximumMakingInvisibleLevels = &lt;value&gt;</code>'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>InstancedStaticMeshComponent CalcBounds</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': "Caching bounds to eliminate most of the time rebuilding the bounds for InstanceStaticMeshes that don't change"}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>PrecachePSOs</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'UPrimitiveComponent::SetupPrecachePSOParams, implemented a new dedicated function to get bUsesWorldPositionOffset'}], [{'type': 'paragraph', 'content': 'UStaticMeshComponent::OnRegister, detect if the component world transform changed and that PrecachePSOs was already called'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>DoesPackageExist</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'FPackageName::DoesPackageExistEx, for the level streaming, instead of testing before requesting the package, let the request execute and handle the error <code class="inline-code">EAsyncLoadingResult::Failed</code> in the completion callback<code class="inline-code"> ULevelStreaming::AsyncLevelLoadComplete</code>'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>AddPrimitive</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Async AddToWorld/AddPrimitive To enable:\xa0 = true'}, {'type': 'paragraph', 'content': 'To enable:\xa0<code class="inline-code">LevelStreaming.AsyncRegisterLevelContext.Enabled</code>'}, {'type': 'paragraph', 'content': 'To setup:\xa0<code class="inline-code">LevelStreaming.AsyncRegisterLevelContext.PrimitiveBatchSize = &lt;value&gt;</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.LevelStreamingAddPrimitiveGranularity = &lt;value&gt;</code>'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>RemoveFromWorld Incremental EndPlay</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Improved time slicing of UWorld::RemoveFromWorld'}, {'type': 'paragraph', 'content': 'To\xa0 enable:\xa0\xa0\n\n<code class="inline-code">s.LevelStreamingRouteActorEndPlayForRemoveFromWorldGranularity = &lt;value&gt;</code>\xa0(0 = disabled)'}]]}]]}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Render Asset Streaming (Texture/Mesh Streaming)</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'FRenderAssetStreamingManager::IncrementalUpdate'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Parallelized processing'}, {'type': 'paragraph', 'content': ' <code class="inline-code">r.Streaming.AllowParallelRenderAssetStreamingManagerIncrementalUpdate = true</code>'}], [{'type': 'paragraph', 'content': 'Caching'}, {'type': 'paragraph', 'content': '<code class="inline-code">r.Streaming.EnableTexturesSamplingStreamingCache = true</code>'}], [{'type': 'paragraph', 'content': 'Other optimizations'}, {'type': 'paragraph', 'content': 'Use: <code class="inline-code">r.Streaming.WorkerCountForParallelRenderAssetStreamingManagerIncrementalUpdate &lt;value&gt;</code> to control the maximum number of workers to use when using <code class="inline-code">r.Streaming.AllowParallelRenderAssetStreamingManagerIncrementalUpdate</code>'}]]}]]}]]}, {'type': 'enhanced_list', 'style': 'ordered', 'items': []}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Unified/Shared Time Budget for ProcessAsyncLoading & UpdateLevelStreaming</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Time budget for ProcessAsyncLoading and UpdateLevelStreaming, runs the async asset and level streaming at the end of the frame from HandleUnifiedStreaming which also handles high priority streaming. UpdateLevelStreaming will have less time if there are hitches in ProcessAsyncLoading, and time unused by UpdateLevelStreaming will be used to process more loaded assets. This also includes performance and timing fixes for functions like RemoveFromWorld which were not correctly computing the elapsed time in some cases.'}, {'type': 'paragraph', 'content': 'To Enable:\xa0<code class="inline-code">s.UseUnifiedTimeBudgetForStreaming 1</code>'}, {'type': 'paragraph', 'content': 'These are the budgets that are taken into account when enabling this unified budget:'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.AsyncLoadingTimeLimit</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.LevelStreamingActorsUpdateTimeLimit</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.PriorityAsyncLoadingExtraTime</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.PriorityLevelStreamingActorsUpdateExtraTime</code>'}]]}]]}, {'type': 'paragraph', 'content': '\xa0 \xa0 \xa0'}]
- [{'type': 'paragraph', 'content': '<b>Fast Geometry Streaming\xa0</b>'}, {'type': 'paragraph', 'content': 'The FastGeo Streaming Plugin is built to achieve faster streaming of actors that are immutable static geometry and that don’t impact gameplay. It uses a faster and more lightweight method for registering and unregistering static geometry to and from the graphic and physics scenes without sacrificing existing World Partition features like Runtime Data Layers and HLODs.\xa0'}, {'type': 'paragraph', 'content': 'It leverages the World Partition - <a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide#wp-importantchangesin55">Runtime Cell Transformer</a> feature to define what can be considered for fast geometry streaming during the streaming generation phase that happens every time entering Play in Editor (PIE) and at Cook time. This makes the process seamless and non-destructive. It can also be layered with multiple Cell Transformers for further improvements.'}, {'type': 'image', 'image_id': 69372, 'caption': '', 'alt_text': '', 'image': {'id': 69372, 'file_name': 'image19.gif', 'file_size': 3101535, 'content_type': 'image/gif', 'created_at': '2025-05-29T23:23:52.251+00:00', 'height': 270, 'width': 480, 'storage_key': '0e888d2b-21b7-4058-b110-0aec4fad9f0d', 'context': 'learning'}, 'storage_key': '0e888d2b-21b7-4058-b110-0aec4fad9f0d', 'context': 'learning', 'width': None, 'autoplay': True}, {'type': 'paragraph', 'content': '<b>To use FastGeo Streaming:</b>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Enable the FastGeo Streaming plugin in your project'}, {'type': 'image', 'image_id': 69373, 'caption': '', 'alt_text': '', 'image': {'id': 69373, 'file_name': 'image8.png', 'file_size': 14453, 'content_type': 'image/png', 'created_at': '2025-05-29T23:26:37.065+00:00', 'height': 100, 'width': 956, 'storage_key': 'a72242a3-7b33-4f80-9f8e-6d6080c13fbc', 'context': 'learning'}, 'storage_key': 'a72242a3-7b33-4f80-9f8e-6d6080c13fbc', 'context': 'learning', 'width': 500}], [{'type': 'paragraph', 'content': 'Add a <code class="inline-code">FastGeoWorldPartitionRuntimeCellTransformer</code> World Partition Runtime Cell Transformer in the World Settings - World Partition Setup of your level.\xa0'}, {'type': 'image', 'image_id': 69374, 'caption': '', 'alt_text': '', 'image': {'id': 69374, 'file_name': 'image46.png', 'file_size': 27365, 'content_type': 'image/png', 'created_at': '2025-05-29T23:27:43.459+00:00', 'height': 361, 'width': 972, 'storage_key': '623cc77e-eca2-4063-9891-e6709d3b6f78', 'context': 'learning'}, 'storage_key': '623cc77e-eca2-4063-9891-e6709d3b6f78', 'context': 'learning', 'width': 500}], [{'type': 'paragraph', 'content': 'Requires <code class="inline-code">p.Chaos.EnableAsyncInitBody = true</code> set in your project'}], [{'type': 'paragraph', 'content': 'PIE or Cook'}]]}, {'type': 'paragraph', 'content': '<b>It is strongly recommended to adjust the AddToWorld / RemoveFromWorld and FastGeo Streaming allowed time budgets based on profiling and the desired outcome for your project.</b>'}, {'type': 'paragraph', 'content': 'I.E. In our internal performance tests using City Sample on current gen game consoles hardware we used the following cvars and values followed by the results:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">s.LevelStreamingActorsUpdateTimeLimit</code> was set to 1ms'}], [{'type': 'paragraph', 'content': '<code class="inline-code">s.UnregisterComponentsTimeLimit </code>was set to 1ms'}], [{'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.MaximumMakingVisibleLevels </code>was set to 2 to allow processing another level while waiting for async tasks'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.TimeBudgetMS</code> was set to 1ms'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.ParallelWorkerCount</code> was set to 4 to avoid any block on slow streaming warnings'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.MaxNumComponentsToProcess</code> was kept to 0 (no limit)'}]]}, {'type': 'image', 'image_id': 69375, 'caption': '', 'alt_text': '', 'image': {'id': 69375, 'file_name': 'Capture.JPG', 'file_size': 104176, 'content_type': 'image/jpeg', 'created_at': '2025-05-29T23:34:29.327+00:00', 'height': 472, 'width': 1157, 'storage_key': '9fa96b23-fd7a-4957-a1e1-325084b2caa9', 'context': 'learning'}, 'storage_key': '9fa96b23-fd7a-4957-a1e1-325084b2caa9', 'context': 'learning', 'width': 800}, {'type': 'image', 'image_id': 69376, 'caption': '', 'alt_text': '', 'image': {'id': 69376, 'file_name': 'image2.png', 'file_size': 428336, 'content_type': 'image/png', 'created_at': '2025-05-29T23:35:10.481+00:00', 'height': 518, 'width': 1802, 'storage_key': 'e67430a5-c56a-4775-a745-71299d46ba3d', 'context': 'learning'}, 'storage_key': 'e67430a5-c56a-4775-a745-71299d46ba3d', 'context': 'learning', 'width': 800}, {'type': 'image', 'image_id': 69377, 'caption': '', 'alt_text': '', 'image': {'id': 69377, 'file_name': 'image7.png', 'file_size': 342770, 'content_type': 'image/png', 'created_at': '2025-05-29T23:35:24.705+00:00', 'height': 521, 'width': 1798, 'storage_key': 'd999ac0b-163c-4b61-8891-223b558d1062', 'context': 'learning'}, 'storage_key': 'd999ac0b-163c-4b61-8891-223b558d1062', 'context': 'learning', 'width': 800}, {'type': 'paragraph', 'content': '<b>Console Variables:</b>'}, {'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.ParallelWorkerCount</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Set the max number of workers to use when creating FastGeo render state'}], [{'type': 'paragraph', 'content': 'Only taken into account if value is greater than 1'}]]}, {'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.TimeBudgetMS</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Maximum time budget in milliseconds for the async render state tasks (0 = no time limit)'}]]}, {'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.MaxNumComponentsToProcess</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Maximum number of components to process (0 = no component limit)'}]]}, {'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.Enable 0</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'FastGeo Streaming can also be disabled using this console variable.'}, {'type': 'paragraph', 'content': 'PIE: This flag will be taken immediately into consideration when running PIE.'}, {'type': 'paragraph', 'content': 'Cook: Changing this variable will require a re-cook of the map/project.'}]]}, {'type': 'paragraph', 'content': '\xa0 \xa0'}, {'type': 'paragraph', 'content': '<b>Transformation Process:</b>'}, {'type': 'paragraph', 'content': 'FastGeo runtime streaming <u class="cdx-underline">requires asynchronous physics state creation/destruction to be enabled</u> (<code class="inline-code">p.Chaos.EnableAsyncInitBody = true</code>).'}, {'type': 'paragraph', 'content': '<u>Partial/Full Transformation</u>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'FastGeo transformer supports partial transformation of actors: only supported components of the actor are transformed.'}], [{'type': 'paragraph', 'content': 'The actor is removed from its level (from the world partition cell) if it’s considered to be fully transformed.For that to be true, any of these conditions must be true:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'All components were transformed'}], [{'type': 'paragraph', 'content': 'The remaining components can be ignored (see IgnoredRemainingComponentClasses & IgnoredRemainingExactComponentClasses in Transformation Setup)'}], [{'type': 'paragraph', 'content': 'The only remaining component is the root component and is a SceneComponent'}]]}], [{'type': 'paragraph', 'content': '<b>IsFullyTransformedActorDeletable</b>: User can implement its own CellTransformer that derives from this one and override the method IsFullyTransformedActorDeletable to prevent an actor from being deleted.'}]]}, {'type': 'paragraph', 'content': '<u>Actor restrictions</u>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Disallowed actor classes: </b>Disallowed actor classes can prevent actors from being transformed.'}], [{'type': 'paragraph', 'content': '<b>Actor Tags: </b>An actor is excluded if its actor tags contain either ‘CellTransformer_IgnoreActor’ or ‘NoFastGeo’.'}], [{'type': 'paragraph', 'content': '<b>Non-spatially loaded:</b> Since transformers are only applied on generated world partition cells, non-spatially loaded actors can’t be transformed (they will be part of the persistent level).'}], [{'type': 'paragraph', 'content': '<b>Replicated:</b> Replicated actors won’t be transformed as FastGeo doesn’t have any custom replication mechanism.'}], [{'type': 'paragraph', 'content': '<b>Non-Static RootComponent Mobility:</b> Actors with a root component which has its mobility not set to Static are not supported.'}], [{'type': 'paragraph', 'content': '<b>Editor-only:</b> Editor-only actors are not supported.'}], [{'type': 'paragraph', 'content': '<b>Child actors: </b>Child actors and actors with child actors are not supported.'}], [{'type': 'paragraph', 'content': '<b>Blueprint with logic:</b> Blueprint actors with logic are not supported. Those with only the construction script are fine.'}], [{'type': 'paragraph', 'content': '<b>Non-fully transformed Blueprint:</b> Partially transformed blueprint actors are not supported.'}], [{'type': 'paragraph', 'content': '<b>Actor References: </b>An actor is excluded if referenced by another actor that is not transformed or partially transformed.'}], [{'type': 'paragraph', 'content': '<b>IsActorTransformable:</b> User can implement its own CellTransformer that derives from this one and override the method IsActorTransformable to decide if an actor can be excluded from the transformation.'}]]}, {'type': 'paragraph', 'content': '\xa0\xa0<u>Component restrictions</u>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Disallowed component classes:</b> Disallowed component classes can prevent actors from being transformed.'}], [{'type': 'paragraph', 'content': '<b>Editor-only: </b>Editor-only components are not supported.'}], [{'type': 'paragraph', 'content': '<b>LODParentPrimitive: </b>Components with a valid LODParentPrimitive are not supported.'}], [{'type': 'paragraph', 'content': '<b>Non-Static Mobility: </b>Components which have its mobility not set to Static are not supported.'}], [{'type': 'paragraph', 'content': '<b>No StaticMesh: </b>StaticMeshComponents with an invalid StaticMesh are not supported.'}], [{'type': 'paragraph', 'content': '<b>No Instances:</b> InstancedStaticMeshComponents with no instances are not supported.'}], [{'type': 'paragraph', 'content': '<b>Non-Nanite HISMC: </b>Hierarchical instanced static mesh components that are using multiple LODs are not supported.'}], [{'type': 'paragraph', 'content': '<b>No Async Collision: </b>Components with collisions that don’t support asynchronous physics state creation and destruction are not supported.'}], [{'type': 'paragraph', 'content': '<b>No collision & invisible: </b>Invisible components with no collision are not supported.'}], [{'type': 'paragraph', 'content': '<b>Skinned Mesh - No Animation: </b>Animated skeletal mesh component / instanced skinned mesh components are not supported.'}], [{'type': 'paragraph', 'content': '<b>Skinned Mesh - No Collision:</b> Skinned mesh with collision or that are navigation relevant are not supported.'}], [{'type': 'paragraph', 'content': '<b>IsComponentTransformable: </b>User can implement its own CellTransformer that derives from this one and override the method IsActorTransformable to decide if an actor can be excluded from the transformation.'}]]}, {'type': 'paragraph', 'content': '<br>'}, {'type': 'paragraph', 'content': '<b>Transformation Setup:</b>'}, {'type': 'paragraph', 'content': 'Under the Fast Geo category, there is a list of settings that allow configuring the transformer.'}, {'type': 'image', 'image_id': 69378, 'caption': '', 'alt_text': '', 'image': {'id': 69378, 'file_name': 'image11.png', 'file_size': 39755, 'content_type': 'image/png', 'created_at': '2025-05-29T23:45:35.453+00:00', 'height': 514, 'width': 948, 'storage_key': 'cf476821-948d-45b1-b24a-e2317561af3d', 'context': 'learning'}, 'storage_key': 'cf476821-948d-45b1-b24a-e2317561af3d', 'context': 'learning', 'width': 500}, {'type': 'paragraph', 'content': '\xa0\xa0'}, {'type': 'paragraph', 'content': '<b>Integration with other systems:</b>'}, {'type': 'paragraph', 'content': '<u class="cdx-underline">Level Streaming</u>'}, {'type': 'paragraph', 'content': 'Since FastGeo relies on the world partition runtime cell transformers, the container still remains the same level.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Because FastGeo Content is streamed-in and streamed-out with the Level, transformed and non-transformed content are treated as a whole and are loaded/unloaded and made visible/invisible at the same time'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This guarantees that HLOD transitions are seamless'}], [{'type': 'paragraph', 'content': 'This guarantees that Runtime Data Layer state changes are in sync for both sets of data'}]]}], [{'type': 'paragraph', 'content': 'FastGeo only uses a single UObject (FastGeoContainer) which stores all FastGeo Components'}], [{'type': 'paragraph', 'content': 'FastGeo Components use a compact structure that contains the necessary information to create the render and physics states in the scene.'}], [{'type': 'paragraph', 'content': 'This UFastGeoContainer derives from UAssetUserData and is stored in the ULevel’s AssetUserData.'}], [{'type': 'paragraph', 'content': 'Level Streaming was modified to allow for custom data to be streamed-in and streamed-out (see <code class="inline-code">AddLevelToWorldExtensionEvent</code> and <code class="inline-code">RemoveLevelFromWorldExtensionEvent</code>)'}], [{'type': 'paragraph', 'content': 'FastGeo Streaming uses these extensions to start asynchronous tasks that create/destroy render/physics states.'}, {'type': 'image', 'image_id': 69379, 'caption': '', 'alt_text': '', 'image': {'id': 69379, 'file_name': 'Capture2.JPG', 'file_size': 122532, 'content_type': 'image/jpeg', 'created_at': '2025-05-29T23:49:33.747+00:00', 'height': 1309, 'width': 1087, 'storage_key': '270dcee5-ddf5-457f-8b33-c149596f9462', 'context': 'learning'}, 'storage_key': '270dcee5-ddf5-457f-8b33-c149596f9462', 'context': 'learning', 'width': 500}]]}, {'type': 'paragraph', 'content': '<u>World Partition HLODs</u>\n\n'}, {'type': 'paragraph', 'content': 'The World Partition HLOD runtime system was modified to support other HLOD objects than HLOD Actors (see <code class="inline-code">IWorldPartitionHLODObject</code>).'}, {'type': 'paragraph', 'content': '<u>Physics</u>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Physics Materials:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The physics state creation was modified to propagate physics material from IPhysicsBodyInstanceOwner objects to physics objects.'}], [{'type': 'paragraph', 'content': 'FastGeo components implement this interface.'}]]}], [{'type': 'paragraph', 'content': 'HitResults & OverlapResults: When hitting a FastGeo primitive, no actor/component is attached to the result.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Helper methods were added to return an associated IPhysicsBodyInstanceOwner for a HitResult or an OverlapResult (see methods for details)'}, {'type': 'paragraph', 'content': 'In class IPhysicsBodyInstanceOwner:'}, {'type': 'paragraph', 'content': '<code class="inline-code">IPhysicsBodyInstanceOwner* GetPhysicsBodyInstandeOwnerFromHitResult(const FHitResult& Result)</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">IPhysicsBodyInstanceOwner* GetPhysicsBodyInstandeOwnerFromOverlapResult(const FOverlapResult& OverlapResult)</code>'}]]}]]}, {'type': 'paragraph', 'content': '<u class="cdx-underline">Texture and Mesh Streaming</u>'}, {'type': 'paragraph', 'content': 'Streamable Render Asset Streaming, is the “Legacy System” that is used to stream Textures mips and LODs for Static or Skeletal meshes.\xa0<u class="cdx-underline">Not to be confused with VirtualTextures, and Nanite</u>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': []}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'TextureSamplingStreamingCache:\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Cache the texture information in base material during loading:'}, {'type': 'paragraph', 'content': '<code class="inline-code">r.Streaming.EnableTexturesSamplingStreamingCache = True</code>'}], [{'type': 'paragraph', 'content': 'Allow use of additional workers to speed up data processing'}, {'type': 'paragraph', 'content': '<code class="inline-code">r.Streaming.AllowParallelRenderAssetStreamingManagerIncrementalUpdate = True</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">r.Streaming.WorkerCountForParallelRenderAssetStreamingManagerIncrementalUpdate = &lt;value&gt;</code>'}]]}], [{'type': 'paragraph', 'content': 'SimpleStreamableAssetManager:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Compatible with FastGeo and required if your project needs texture or mesh streaming'}], [{'type': 'paragraph', 'content': 'Integrated with SceneProxy, supports any object type, cheap registration and asynchronous execution'}, {'type': 'paragraph', 'content': '<code class="inline-code">s.StreamableAssets.UseSimpleStreamableAssetManager=True</code>'}]]}]]}, {'type': 'paragraph', 'content': '<u>Navigation</u>'}, {'type': 'paragraph', 'content': 'FastGeo is compatible with the dynamic navmesh to update system.'}, {'type': 'paragraph', 'content': '<u>Static Lighting</u>'}, {'type': 'paragraph', 'content': 'FastGeo doesn’t currently support static lighting.\xa0\xa0'}, {'type': 'paragraph', 'content': '\xa0 \xa0'}, {'type': 'paragraph', 'content': '<b>Debugging:</b>'}, {'type': 'paragraph', 'content': 'Because of all the restrictions described above when using FastGeo, it can be difficult to know why an actor or a component has not been transformed. A set of debugging tools were added to help identify and fix the content to be transformable.'}, {'type': 'paragraph', 'content': '<u>FastGeo Actor Coloration\n\n</u>'}, {'type': 'paragraph', 'content': '\n\nAn actor coloration was added to differentiate transformed from non-transformed actors.'}, {'type': 'paragraph', 'content': 'To enable, use the console command: <code class="inline-code">show ActorColoration FastGeo</code>'}, {'type': 'image', 'image_id': 69380, 'caption': '', 'alt_text': '', 'image': {'id': 69380, 'file_name': 'image30.png', 'file_size': 1260792, 'content_type': 'image/png', 'created_at': '2025-05-30T00:09:58.323+00:00', 'height': 854, 'width': 1533, 'storage_key': 'a01e0783-3c03-4db3-ba02-36d796975a12', 'context': 'learning'}, 'storage_key': 'a01e0783-3c03-4db3-ba02-36d796975a12', 'context': 'learning', 'width': 200}, {'type': 'paragraph', 'content': '<u>Show/Hide FastGeo Content</u>'}, {'type': 'paragraph', 'content': 'It is also possible to hide all FastGeo content from the scene to see what was not transformed.To change FastGeo content visibility, use the console command:\xa0 <code class="inline-code">FastGeo.Show 0/1</code>'}, {'type': 'image', 'image_id': 69381, 'caption': '', 'alt_text': '', 'image': {'id': 69381, 'file_name': 'image40.png', 'file_size': 1897491, 'content_type': 'image/png', 'created_at': '2025-05-30T00:10:28.859+00:00', 'height': 861, 'width': 1537, 'storage_key': 'e0e5f860-cd68-4182-bb38-67d8c80ac3f3', 'context': 'learning'}, 'storage_key': 'e0e5f860-cd68-4182-bb38-67d8c80ac3f3', 'context': 'learning', 'width': 200}, {'type': 'paragraph', 'content': '<u class="cdx-underline">Transformer Debug Mode</u>'}, {'type': 'paragraph', 'content': 'The Debug Mode options allow writing in the output log the reason why actors/components are not transformable.'}, {'type': 'paragraph', 'content': 'This logging can be enabled for 3 different scenarios:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'PIE: During PIE, the transformation happens only when a world partition cell is streamed-in, using the transformer flag Debug Mode will log everything a cell is streamed-in.'}], [{'type': 'paragraph', 'content': 'Cooking: During cooking, a console variable can be used to enable the debug mode: <code class="inline-code">FastGeo.EnableTransformerDebugMode=1</code>'}], [{'type': 'paragraph', 'content': 'Selection: Combined with the FastGeo actor coloration, using the Debug Mode on Selection flag will log based on the selection.'}]]}, {'type': 'image', 'image_id': 69382, 'caption': '', 'alt_text': '', 'image': {'id': 69382, 'file_name': 'image20.png', 'file_size': 3268587, 'content_type': 'image/png', 'created_at': '2025-05-30T00:11:04.093+00:00', 'height': 922, 'width': 1834, 'storage_key': '69769994-c6a7-47ad-a239-ca82ec90c393', 'context': 'learning'}, 'storage_key': '69769994-c6a7-47ad-a239-ca82ec90c393', 'context': 'learning', 'width': 200}, {'type': 'paragraph', 'content': '\xa0 \xa0\xa0'}, {'type': 'paragraph', 'content': '<b>Runtime Console variables:</b>'}, {'type': 'paragraph', 'content': 'Some console variables allow control and balance over the runtime execution of FastGeo.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.ParallelWorkerCount</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Set the max number of workers to use when creating FastGeo render state.'}], [{'type': 'paragraph', 'content': 'Only taken into account if value is greater than 1.'}]]}], [{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.TimeBudgetMS</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Maximum time budget in milliseconds for the async render state tasks (0 = no time limit)'}]]}], [{'type': 'paragraph', 'content': '<code class="inline-code">FastGeo.AsyncRenderStateTask.MaxNumComponentsToProcess</code>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Maximum number of components to process (0 = no component limit)'}, {'type': 'paragraph', 'content': '\xa0 \xa0'}]]}]]}]
- [{'type': 'paragraph', 'content': '<b>City Sample project updated!</b>'}, {'type': 'paragraph', 'content': 'The City Sample project has been updated alongside the release of Unreal Engine 5.6 to take advantage of the streaming performance improvements and the FastGeo Streaming plugin. It can be used as an example on how to best optimize for streaming a large open world environment with these latest changes and features.'}]


#### 

- [{'type': 'paragraph', 'content': '<b>Runtime Cell Transformers</b>'}, {'type': 'paragraph', 'content': 'Runtime Cell Transformers are non-destructive stackable data transformation processes that are applied during the streaming generation phase when cooking\xa0 and launching into PIE. It is ideal to optimize dense environments containing multiple immutable StaticMeshActors but can be extended to any project needs.'}, {'type': 'paragraph', 'content': 'A base <code class="inline-code">WorldPartitionRuntimeCellTransformerISM </code>class is distributed with the engine and can be used to quickly optimize StaticMeshActors and  Partitioned Actors (PCG, Foliage, etc) by gathering and combining as Instanced Static Mesh Components (ISMs) in a single actor per cell. Using this base class will only impact non-dynamic, non-replicated actors, while having no impact on HLODs and remain completely non-destructive, since it is reapplied on every PIE/Cook over the Editor data.'}, {'type': 'image', 'image_id': 69384, 'caption': '', 'alt_text': '', 'image': {'id': 69384, 'file_name': 'image53.png', 'file_size': 62871, 'content_type': 'image/png', 'created_at': '2025-05-30T00:25:33.476+00:00', 'height': 494, 'width': 1234, 'storage_key': '99154415-2c94-471c-b8ed-571893b41ee7', 'context': 'learning'}, 'storage_key': '99154415-2c94-471c-b8ed-571893b41ee7', 'context': 'learning', 'width': 500}, {'type': 'paragraph', 'content': 'The resulting transformation can be easily viewed with the actor coloration framework while in-game using: Show ActorColoration CellTransformerISM'}, {'type': 'callout', 'callout_type': 'note', 'blocks': [{'type': 'paragraph', 'content': 'Note: it is still recommended to pre-pack content when possible at streaming grid size (i.e. a building can be pre-packed, a city block might be too big) using ISM through Packed Level Actors or PCG Partitioned spawning. This will always ensure better editor performance and control in comparison to the automatic transformation coming from Cell Transformers. Both strategies can be combined for optimal runtime output.'}]}, {'type': 'paragraph', 'content': '\xa0 \xa0'}]
- [{'type': 'paragraph', 'content': '<b>Static Lighting Support in World Partition levels</b>'}, {'type': 'paragraph', 'content': 'Experimental support for Static Lighting added for World Partition levels and Level Instances. Both lightmaps and volumetric lightmaps techniques are supported using CPU Lightmass.\xa0'}, {'type': 'callout', 'callout_type': 'alert', 'blocks': [{'type': 'paragraph', 'content': 'Important: No additional work is planned on this in our current development roadmap, projects that require extra features or changes will need to extend it on their own.'}]}, {'type': 'paragraph', 'content': '\xa0\xa0\xa0\xa0'}, {'type': 'paragraph', 'content': 'Lightmaps data in world partition level is packaged per grid cell for streaming according to their Actor streaming settings. Volumetric Lightmaps use independent Cellsize and distances which can be adjusted under World Settings - Lightmass'}, {'type': 'paragraph', 'content': 'A new World Partition Static Lighting commandlet builder is provided and is recommended for loading and baking static lighting in World Partition levels.'}, {'type': 'paragraph', 'content': 'VolumetricLightamps require the use of the <code class="inline-code">-singlepass </code>commandline option at the moment.\xa0'}, {'type': 'paragraph', 'content': 'Actors last saved with a version lower than 5.5 may require a resave, you can use the -savealldirtypackages to force those packages to be resaved by the builder and submit then.\xa0'}, {'type': 'paragraph', 'content': 'It is required to <code class="inline-code">Allow Static Lighting</code> in project settings and include <code class="inline-code">r.AllowStaticLightingInWorldPartitionMaps=1</code> to the DefaultEngine.ini config file.'}, {'type': 'paragraph', 'content': 'Commandlet example:'}, {'type': 'paragraph', 'content': '<code class="inline-code">&lt;ProjectName&gt; &lt;MapName&gt; -run=WorldPartitionBuilderCommandlet -AllowCommandletRendering -singlepass -Builder=WorldPartitionStaticLightingBuilder -Build -LogCmds="WorldPartitionStaticLightingBuilder &lt;desiredloglevel&gt;"</code>'}]


#### 

- [{'type': 'paragraph', 'content': 'Using a list of partition objects that can be of different types'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Licensees can now implement their own partitioning schemes easily, without having to implement custom code for HLODs and Data Layers.'}], [{'type': 'paragraph', 'content': 'Each object holds their HLODSetups layer settings'}]]}]
- [{'type': 'paragraph', 'content': 'Supports 3D partitioning and streaming from the provided Loose Hierarchical Grid partition type.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Reduces streaming level promotion problems around the axis and grid origin with a variable cell size approach.'}], [{'type': 'paragraph', 'content': 'Actor bounds are used to define their streaming level and scale the resulting cell size within up to 1.5x of the defined grid size before being promoted.'}]]}]
- [{'type': 'paragraph', 'content': 'Retains full support of OFPA, Data Layers, Level Instances, Streaming Sources and HLODs'}]
- [{'type': 'paragraph', 'content': 'Performance and memory measured in Fortnite BR are similar or better than previous Spatial Hash'}]
- [{'type': 'paragraph', 'content': 'Removed the complexity around advanced CVARs changing the behavior of the previous Spatial Hash for Grid promotion, Placement rule (pivot or bounds), Grid Alignment as they are not required with the new Runtime Hash and Loose Hierarchical Grid.'}]
- [{'type': 'paragraph', 'content': 'New world partition levels created in UE 5.4 will default to Runtime Hash + Loose Hierarchical Grid'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Spatial hash to Runtime Hash upgrade path is provided'}], [{'type': 'paragraph', 'content': 'The default hash type used for new worlds can be changed in the Project Settings'}]]}]

- [{'type': 'paragraph', 'content': 'Tile-based worlds (i.e as currently used in Lego Fortnite): multiple layers of sub-world partition levels are adjacent to each other, producing a very large world. Tiles can be statically or dynamically selected where each individual tile layer is running its own world partition system. '}, {'type': 'image', 'image_id': 57036, 'caption': '', 'alt_text': '', 'image': {'id': 57036, 'file_name': 'image17.png', 'file_size': 135513, 'content_type': 'image/png', 'created_at': '2024-07-24T13:39:59.248+00:00', 'height': 572, 'width': 1034, 'storage_key': 'a606142d-f53d-4e7b-a0cb-08fba24a5602', 'context': 'learning'}, 'storage_key': 'a606142d-f53d-4e7b-a0cb-08fba24a5602', 'context': 'learning', 'width': 500}, {'type': 'image', 'image_id': 57037, 'caption': '', 'alt_text': '', 'image': {'id': 57037, 'file_name': 'image3.png', 'file_size': 34308, 'content_type': 'image/png', 'created_at': '2024-07-24T13:40:12.390+00:00', 'height': 544, 'width': 665, 'storage_key': 'c3e217ed-4357-43e5-9452-39af9937cb1e', 'context': 'learning'}, 'storage_key': 'c3e217ed-4357-43e5-9452-39af9937cb1e', 'context': 'learning', 'width': 500}]
- [{'type': 'paragraph', 'content': '<b>Specific areas</b> (i.e dynamically set location): within a larger base world use dynamic sub-world partitions to change a specific targeted area and/or control its streaming grid setup independently from the base world.'}, {'type': 'image', 'image_id': 57038, 'caption': '', 'alt_text': '', 'image': {'id': 57038, 'file_name': 'image8.png', 'file_size': 209390, 'content_type': 'image/png', 'created_at': '2024-07-24T13:41:33.286+00:00', 'height': 442, 'width': 1141, 'storage_key': 'c07c9542-c819-49c3-b307-de59b68cf537', 'context': 'learning'}, 'storage_key': 'c07c9542-c819-49c3-b307-de59b68cf537', 'context': 'learning', 'width': 500}]


```

```


#### 


```

```


#### 

- [{'type': 'paragraph', 'content': 'Actors: Additional check for AABB &lt; grid cell size (2D), if true the actor will be assigned to the grid cell using its pivot position.'}]
- [{'type': 'paragraph', 'content': 'Partitioned actors (Landscape proxies, Foliage actors, etc) use pivot.'}]
- [{'type': 'paragraph', 'content': 'CVAR:\xa0\n\n<code class="inline-code">wp.Runtime.RuntimeSpatialHashPlaceSmallActorsUsingLocation=1</code>\xa0\xa0(limited to the base grid level, regular promotion occurs if the object fails this test)'}]

- [{'type': 'paragraph', 'content': 'CVARs:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.RuntimeSpatialHashUseAlignedGridLevels=0</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.RuntimeSpatialHashSnapNonAlignedGridLevelsToLowerLevels=0</code>'}]]}]


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine#worldpartitionfoliagebuilder">World Partition Foliage Builder</a>'}]
- [{'type': 'paragraph', 'content': 'World Partition Landscape Builder is not yet implemented but planned.'}]

- [{'type': 'paragraph', 'content': 'Coming external data layers / game feature plugin development supports injecting specific actors at runtime.'}]
- [{'type': 'paragraph', 'content': 'Level instancing is possible through code.'}]


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.ToggleDrawRuntimeHash2D or 3D</code> : toggles streaming grid debug display.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.OverrideRuntimeLoadingRange -grid=[index] -range=[DesiredValue]</code>: overrides loading range.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.OverrideRuntimeSpatialHashLoadingRange -grid=[index] -range=[DesiredValue]</code> : overrides loading range.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.runtime.hlod </code>: toggles HLODs display.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.DebugDedicatedServerStreaming</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.HashSet.ShowDebugDisplayLevel</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.HashSet.ShowDebugDisplayLevelCount</code>'}]


### 


#### 


#### 


#### 


#### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Major performance issues when editing and deleting multiple files.'}]
- [{'type': 'paragraph', 'content': 'Edge vs commit/proxies files status not matching.'}]

- [{'type': 'paragraph', 'content': '<code class="inline-code">UWorldPartitionBlueprintLibrary</code> utility library to access ActorDescs through BP.'}]


#### 

- [{'type': 'paragraph', 'content': 'External Actors files in WP are named with GUIDs and sorted automatically based on these in a specific folder structure, which makes them impossible to identify correctly within an external source control application such a P4V. Unreal’s view changelist window displays the actor display name, type and path, allowing you to properly filter, sort and manage these files.'}]
- [{'type': 'paragraph', 'content': 'Uncontrolled CL is a powerful tool which is not available outside Unreal.'}]
- [{'type': 'paragraph', 'content': 'Validation is done at submit (or at user’s request) on the changelist’s content preventing users from introducing data issues. The validation can be extended in code for specific project needs.'}]


#### 


#### 


#### 


### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Nested and Hierarchical Level Instances.'}]
- [{'type': 'paragraph', 'content': 'Edit in Context (always the original level, no per-instance data/edit supported).'}]
- [{'type': 'paragraph', 'content': 'Multiple Instances within the same World.'}]
- [{'type': 'paragraph', 'content': 'Embedded Mode (default) : Content pushed to the persistent world partition grid.'}]
- [{'type': 'paragraph', 'content': 'Standalone Mode (previously Level Streaming Mode): For non-OFPA levels and in 5.4 for, OFPA levels to consider as a block or for sub-world partition.'}]
- [{'type': 'paragraph', 'content': 'Data Layers on the Level Instance Actor is propagated to its entire content.'}]
- [{'type': 'paragraph', 'content': 'Data Layers are supported on actors within Level Instances, the persistent world DL Instances defines the states. (new in 5.1).'}]
- [{'type': 'paragraph', 'content': 'Is Main World Only: only load when loaded from a persistent world directly'}]
- [{'type': 'paragraph', 'content': 'Actor Filters / Variants support (new in 5.4)'}]

- [{'type': 'paragraph', 'content': 'POI, houses, interiors, building floors, deco sets, villages, stand alone gameplay setups, etc.'}]

- [{'type': 'paragraph', 'content': 'Outputs a Packed Level Actor BP with ONLY SM/ISM/HISM from the content.'}]
- [{'type': 'paragraph', 'content': 'Outputs a Level that is associated with the Packed Level Actor for non-destructive editing.'}]
- [{'type': 'paragraph', 'content': 'Multiple instances, like any actor, within the same world.'}]
- [{'type': 'paragraph', 'content': 'Edit in Context (always the original level, no per-instance data/edit supported).'}]
- [{'type': 'paragraph', 'content': 'Data Layers on the Packed Level Actor only.'}]
- [{'type': 'paragraph', 'content': 'Can be used in Level Instances like any other actors'}]


#### 

- [{'type': 'paragraph', 'content': 'The property override feature the experimental editor flag needs to be enabled'}, {'type': 'image', 'image_id': 69504, 'caption': '', 'alt_text': '', 'image': {'id': 69504, 'file_name': 'image52.png', 'file_size': 7291, 'content_type': 'image/png', 'created_at': '2025-05-30T21:48:29.528+00:00', 'height': 125, 'width': 654, 'storage_key': '4ba114ad-6675-4396-97f6-690866683dce', 'context': 'learning'}, 'storage_key': '4ba114ad-6675-4396-97f6-690866683dce', 'context': 'learning', 'width': 800}]
- [{'type': 'paragraph', 'content': 'Also a Property Override policy class needs to be set in the games DefaultEngine.ini file'}, {'type': 'paragraph', 'content': '<code class="inline-code">[/Script/Engine.LevelInstanceSettings]</code>'}, {'type': 'paragraph', 'content': '<code class="inline-code">PropertyOverridePolicyClass=/Script/Engine.LevelInstancePropertyOverrideSamplePolicy</code>'}]

- [{'type': 'paragraph', 'content': 'To override properties right click on the Level Instance you want to override properties on and select <b>Level - Override</b>'}, {'type': 'image', 'image_id': 69505, 'caption': '', 'alt_text': '', 'image': {'id': 69505, 'file_name': 'image32.png', 'file_size': 326883, 'content_type': 'image/png', 'created_at': '2025-05-30T21:54:06.235+00:00', 'height': 770, 'width': 628, 'storage_key': '6fab0a45-d5f2-457f-aebc-a5f339af869d', 'context': 'learning'}, 'storage_key': '6fab0a45-d5f2-457f-aebc-a5f339af869d', 'context': 'learning', 'width': 500}]
- [{'type': 'paragraph', 'content': 'The Level Instance will go into Property Override edit mode which is similar to regular Level instance edit, you can notice that in the outliner the Level instance is highlighted in blue instead of green (regular edit)'}, {'type': 'image', 'image_id': 69506, 'caption': '', 'alt_text': '', 'image': {'id': 69506, 'file_name': 'image27.png', 'file_size': 13466, 'content_type': 'image/png', 'created_at': '2025-05-30T21:55:09.135+00:00', 'height': 120, 'width': 418, 'storage_key': '19d6291a-b1f7-4540-af73-86ad947839b0', 'context': 'learning'}, 'storage_key': '19d6291a-b1f7-4540-af73-86ad947839b0', 'context': 'learning', 'width': 500}]
- [{'type': 'paragraph', 'content': 'Then select actors within this Level instance and change their properties. Once done with the edit you can hit the overlay button which will prompt you to save those overrides.'}, {'type': 'image', 'image_id': 69507, 'caption': '', 'alt_text': '', 'image': {'id': 69507, 'file_name': 'image50.png', 'file_size': 18998, 'content_type': 'image/png', 'created_at': '2025-05-30T21:55:37.877+00:00', 'height': 88, 'width': 289, 'storage_key': '9637ba8f-427b-4d85-9b93-3719aec338d2', 'context': 'learning'}, 'storage_key': '9637ba8f-427b-4d85-9b93-3719aec338d2', 'context': 'learning', 'width': 300}, {'type': 'image', 'image_id': 69508, 'caption': '', 'alt_text': '', 'image': {'id': 69508, 'file_name': 'image47.png', 'file_size': 539315, 'content_type': 'image/png', 'created_at': '2025-05-30T21:56:00.799+00:00', 'height': 752, 'width': 1008, 'storage_key': 'cf99e81e-0c03-4240-8d3a-72ea00c5d38e', 'context': 'learning'}, 'storage_key': 'cf99e81e-0c03-4240-8d3a-72ea00c5d38e', 'context': 'learning', 'width': 500}]


#### 


```

```


#### 


#### 


#### 


#### 


#### 


#### 


### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Handle different scenarios.'}]
- [{'type': 'paragraph', 'content': 'Create variation within the same world.'}]
- [{'type': 'paragraph', 'content': 'Manage specific data for sequences, missions, game progression, events and more.'}]
- [{'type': 'paragraph', 'content': 'Full HLODs support, creates a specific HLOD that will be following the Data Layer state.'}]
- [{'type': 'paragraph', 'content': 'Is also an Editor data layer.'}]
- [{'type': 'paragraph', 'content': 'Each Data Layer Instances have specific settings including their Initial Runtime State'}]

- [{'type': 'paragraph', 'content': 'Organize your content.'}]
- [{'type': 'paragraph', 'content': 'Isolate data for better in-context work.'}]
- [{'type': 'paragraph', 'content': 'Preview runtime data layer content.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Editor only data layers are not accessible in PIE and Cooked builds.'}]]}]


#### 


#### 

- [{'type': 'paragraph', 'content': 'In the Content Browser, under the Game Feature plugin Content, create an External Data Layer Asset'}]
- [{'type': 'paragraph', 'content': 'In the Game Feature Data asset, add a Game Feature Action called “Add World Partition Content”'}]
- [{'type': 'paragraph', 'content': 'Under this new action, choose the newly created External Data Layer asset'}]
- [{'type': 'paragraph', 'content': 'Save the Game Feature Data asset'}, {'type': 'image', 'image_id': 69511, 'caption': '', 'alt_text': '', 'image': {'id': 69511, 'file_name': 'image26.png', 'file_size': 57250, 'content_type': 'image/png', 'created_at': '2025-05-30T23:16:05.975+00:00', 'height': 813, 'width': 911, 'storage_key': '9c84e44b-6b4f-4e56-8034-b716d3ad2cfb', 'context': 'learning'}, 'storage_key': '9c84e44b-6b4f-4e56-8034-b716d3ad2cfb', 'context': 'learning', 'width': 800}]

- [{'type': 'paragraph', 'content': 'Open the partitioned map to inject Game Feature content'}]
- [{'type': 'paragraph', 'content': 'Drag the newly created External Data Layer asset in the Data Layer Outliner'}, {'type': 'paragraph', 'content': 'or'}]
- [{'type': 'paragraph', 'content': 'Right-click, choose Create New Data Layer With Asset and pick the External Data Layer asset'}]


#### 


```

```


#### 


#### 

- [{'type': 'paragraph', 'content': 'Sharing the same data layer assets across multiple worlds within a project.'}]
- [{'type': 'paragraph', 'content': 'Data layer support for actors in level instances.'}]
- [{'type': 'paragraph', 'content': 'Different default states per-world.'}]


#### 


#### 

- [{'type': 'paragraph', 'content': 'This means that activating a data layer does not mean that all of its content will be loaded immediately, <b>streaming still needs to be taken into account and actors/grids/loading ranges/streaming sources configured properly.</b>'}]


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.DumpDatalayers</code>: dumps the list of data layers and their runtime state in the log.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.DebugFilerByDatalayer</code>: used to filter which data layer is visible in the runtime hash 2d debug display.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.SetDataLayerRuntimeState [state] [layer]</code>: force a data layer to a specific runtime state.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.ToggleDataLayerActivation [layer]</code>: activate/deactivate a specific runtime data layer.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">wp.Runtime.ToggleDrawDataLayers</code>: shows list of data layers and their states in the main view.'}]


### 


#### 


#### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Works with merged and simplified layers'}]
- [{'type': 'paragraph', 'content': 'Easily load regions overlapping HLODs by selecting, right click, load region from selection'}]
- [{'type': 'paragraph', 'content': 'User settings to toggle, show on top of loaded regions and set min and max draw distance'}]
- [{'type': 'paragraph', 'content': 'Rebuild each section individually which can be also useful to test changes or get a specific section up to date locally for composition or debugging.'}]


#### 

- [{'type': 'paragraph', 'content': 'Automatic creation of hlods meshes for water.'}]
- [{'type': 'paragraph', 'content': 'Settings for material and layer to use within water body actors.'}]


#### 

- [{'type': 'paragraph', 'content': 'Factors to consider: platforms memory and performance, instancing, nanite streaming, world density, world scale, grid sizes, asset types (trees, buildings, others), etc.'}]


#### 


#### 


#### 


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Level Color'}]
- [{'type': 'paragraph', 'content': 'Property Color (Ctrl + Click any actor property in a Detail Panel to highlight actors sharing the same property value!)'}]
- [{'type': 'paragraph', 'content': 'Affects NavMesh'}]
- [{'type': 'paragraph', 'content': 'HLOD Relevant Color'}]
- [{'type': 'paragraph', 'content': 'Current Data Layer Color'}]


#### 

- [{'type': 'paragraph', 'content': 'UX improvements and standardization'}]
- [{'type': 'paragraph', 'content': 'More display options'}]

- [{'type': 'paragraph', 'content': 'Removed editor grid completely and replaced with transient regions and persistent location actors.'}]
- [{'type': 'paragraph', 'content': 'Shortcuts to load, zoom, play from here, measure, create location volume from region'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Shift+Drag will snap selection to the current grid size.'}], [{'type': 'paragraph', 'content': 'Double+Click will move the camera at the clicked location in all viewports.'}], [{'type': 'paragraph', 'content': 'Shift+Double Click will PIE at the clicked location.'}], [{'type': 'paragraph', 'content': 'Control+Double Click will load around the clicked location.'}], [{'type': 'paragraph', 'content': 'Middle Click+Drag will show a measuring tool similar to the top view one.'}], [{'type': 'paragraph', 'content': 'Checking "Follow Player in PIE" will follow the player in the minimap.'}]]}]
- [{'type': 'paragraph', 'content': 'Better UX to indicate that no regions are loaded when loading WP for first time users.'}]


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'The level it is created or updated from'}]
- [{'type': 'paragraph', 'content': 'The camera transforms and FOV'}]
- [{'type': 'paragraph', 'content': 'Loaded regions and locations volumes at the time of bookmark creation/update'}]
- [{'type': 'paragraph', 'content': 'Data layers states'}]
- [{'type': 'paragraph', 'content': 'Editor Context (current folder, current data layers)'}]
- [{'type': 'paragraph', 'content': 'Category'}]


#### 


#### 


#### 


#### 


#### 


### 


#### 


#### 


#### 


#### 


### 


#### 


#### 


### 


#### 


#### 


####