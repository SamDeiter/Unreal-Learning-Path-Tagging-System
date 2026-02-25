# Level Streaming Deep Dive

*Whether you have worked with the Level Streaming system or not, this guide covers the basics to the more advanced topics in the area.*

## 

- [{'type': 'paragraph', 'content': '<b>Managing memory</b>\xa0for a large world where its content cannot be loaded into memory all at once.'}]
- [{'type': 'paragraph', 'content': '<b>Conditionally controlling</b>\xa0gameplay content, such as when a player completes a quest, resulting in sets of actors being changed out.'}]
- [{'type': 'paragraph', 'content': 'In older Unreal Engine versions, streaming levels were also widely helpful in reducing source control contention or for organizational purposes. UE5 has since addressed these by introducing <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/one-file-per-actor-in-unreal-engine">One File Per Actor</a> and <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---data-layers-in-unreal-engine">World Partition\'s Data Layers</a>.'}]


## 


### 

- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">AActor</u>\xa0</b>- A gameplay element that may consist of multiple components (see\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/actors-in-unreal-engine">documentation</a>).'}]
- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">ULevel\xa0</u></b>- A collection of Actors (see\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-levels-in-unreal-engine">documentation</a>).'}]
- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">UWorld</u>\xa0</b>- The top-level object representing a map that consists of a collection of levels and provides context in which the level(s) exist.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Always contains a single persistent level.'}], [{'type': 'paragraph', 'content': 'Can optionally contain a collection of streaming levels.'}]]}]
- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">ULevelStreaming</u>\xa0</b>- Manages the data required to stream a level and provides the interface to transition the level between different streaming states.'}]
- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">UPackage</u>\xa0</b>- The in-memory container for the contents of an asset file.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The outermost object for assets and levels.'}], [{'type': 'paragraph', 'content': 'A UPackage containing a world will have the\xa0<code class="inline-code">PKG_ContainsMap</code>\xa0package flag.'}]]}]
- [{'type': 'paragraph', 'content': '<b><u class="cdx-underline">.umap</u></b>\xa0- A specific Unreal asset file type used to store a world and its persistent level on disk (i.e., the on-disk representation of a map containing UPackage).'}]


### 


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Finding the map package on disk associated with the level that we want to stream in and reading it into memory.'}]
- [{'type': 'paragraph', 'content': 'Creating the actual UObjects, serializing them, and then finalizing the load of the objects.'}]


#### 

- [{'type': 'paragraph', 'content': 'Actor component registration (see\xa0<code class="inline-code">ULevel::IncrementalUpdateComponents</code>)'}]
- [{'type': 'paragraph', 'content': 'Actor initialization (see\xa0<code class="inline-code">ULevel::RouteActorInitialize</code>)'}]


### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine">World Partition\xa0(recommended)</a>'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/level-streaming-overview-in-unreal-engine">Level Streaming Overview</a>'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Minimize the number of actors and actor components as much as you can.'}, {'type': 'paragraph', 'content': 'This advice may seem obvious at face value: The fewer objects that need to be loaded and processed, the more efficient the game will be. However, this is not necessarily saying to reduce the overall gameplay content (unless feasible), but rather find ways to represent gameplay content with the least amount of overhead.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'For example, use\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/instanced-static-mesh-component-in-unreal-engine">instancing\xa0</a>as much as possible instead of multiple identical static mesh actors. As mentioned in the instancing documentation, ISM components (instanced static mesh) should be used for nanite meshes, while HISM components\xa0 (hierarchical instanced static mesh) should be used for non-nanite meshes. Note that you may still want to spread the instances across multiple ISM/HISMs, such as to completely unload them or reduce the registration of one large component.'}]]}]
- [{'type': 'paragraph', 'content': 'Minimize the complexity of actors and actor components as much as you can.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'For example, some gameplay objects may not require complex physics, in which a\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/simple-versus-complex-collision-in-unreal-engine">simple collision shape</a>\xa0will be adequate without sacrificing the overall gameplay behavior.'}]]}]
- [{'type': 'paragraph', 'content': 'Adjust the granularity of the streaming levels.'}, {'type': 'paragraph', 'content': 'How much gameplay content should be in a level is dependent on the content itself, which is project-specific. If gameplay content is not available between the time it is requested and the time it is required, then consider breaking it up across more sublevels where you can make the more critically important content be streamed in first.'}]
- [{'type': 'paragraph', 'content': 'Only load gameplay content that should be relevant for play.'}, {'type': 'paragraph', 'content': 'When possible, use soft references over hard references to delay the loading of any objects that are not immediately required.'}, {'type': 'paragraph', 'content': "Distant objects outside the proximity of the player that have no impact don't require being loaded. If they still need to be visually represented in the distance, consider using HLODs."}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Non-WP HLODs do not work with streamed levels and require a custom solution to handle them.'}]]}]
- [{'type': 'paragraph', 'content': 'The streaming priority can be set for streaming levels containing critically important gameplay content.'}]
- [{'type': 'paragraph', 'content': 'To prevent blocking the main game thread as much as possible, avoid making synchronous load requests, such as\xa0<code>LoadObject</code>.\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Starting in 5.5,\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/zen-loader-in-unreal-engine">ZenLoader</a>\xa0prevents the flushing of irrelevant loads unless they are required to complete the load requested to be flushed.'}]]}]
- [{'type': 'paragraph', 'content': 'Additional Resources:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide#worldbuildingguide">World Building Guide</a>'}], [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/instanced-static-mesh-component-in-unreal-engine">Instancing</a>'}], [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/hierarchical-level-of-detail-in-unreal-engine">HLODs</a>'}], [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/merging-actors-in-unreal-engine">Merge Actors</a>'}], [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/6XW8/unreal-engine-the-great-hitch-hunt-tracking-down-every-frame-drop">The Great Hitch Hunt: Tracking Down Every Frame Drop</a>'}]]}]


#### 

- [{'type': 'paragraph', 'content': "Don't GC if it can be avoided. Alternatively, manually trigger it during non-essential or low-priority play, such as during pause menus, loading transitions, or maybe even in simpler out-of-combat areas, in order to reduce the workload of the periodic GC passes."}]
- [{'type': 'paragraph', 'content': 'The fewer UObjects, the less work the GC will need to do.'}]
- [{'type': 'paragraph', 'content': 'Use <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties">UProperties </a>to expose references to the engine and prevent them from being GC\'d.'}]
- [{'type': 'paragraph', 'content': 'Try to limit outgoing references from classes to other objects. This helps keep the reference graph smaller and also helps prevent objects from being unintentionally kept alive.'}]
- [{'type': 'paragraph', 'content': 'Use <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-object-handling-in-unreal-engine#garbagecollection">GC clustering</a>.'}]
- [{'type': 'paragraph', 'content': 'Additional Resources:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/xaY1/unreal-engine-primer-debugging-garbage-collection-performance">Debugging GC Primer</a>'}], [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/ePKR/unreal-engine-garbage-collector-internals">Garbage Collection Internals</a>'}]]}]


### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">s.AsyncLoadingTimeLimit</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">s.PriorityAsyncLoadingExtraTime</code>'}]


#### 


##### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AllowIncrementalPreRegisterComponents</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">p.Chaos.EnableAsyncInitBody</code>'}]

- [{'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AsyncRegisterLevelContext.Enabled</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">LevelStreaming.AsyncRegisterLevelContext.PrimitiveBatchSize</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">s.LevelStreamingAddPrimitiveGranularity</code>'}]


#### 


#### 

- [{'type': 'paragraph', 'content': 'The trash packages still take up memory until garbage collected.'}]
- [{'type': 'paragraph', 'content': 'Increased UObject counts will mean longer garbage collection times.'}]


#### 

- [{'type': 'paragraph', 'content': 'Introduced a setting to unify the time budgets for ProcessAsyncLoading and UpdateLevelStreaming together. When enabled, hitches in ProcessAsyncLoading will cause UpdateLevelStreaming to have less time. Any unused time by UpdateLevelStreaming will be used to process more loaded assets.'}, {'type': 'paragraph', 'content': 'CVar:\xa0<code class="inline-code">s.UseUnifiedTimeBudgetForStreaming</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">RenderAssetStreamingManager::IncrementalUpdate</code>Use parallelization where possible when adding components to FLevelRenderAssetManager & FDynamicRenderAssetInstanceManager.'}, {'type': 'paragraph', 'content': 'CVar:\xa0<code class="inline-code">r.Streaming.AllowParallelRenderAssetStreamingManagerIncrementalUpdate</code>'}]
- [{'type': 'paragraph', 'content': 'Some other noteworthy Improvements that are automatically enabled to provide passive benefits (no setting associated):'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Introduced bounds cache for UInstancedStaticMeshComponent. Eliminates the amount of time the game thread spends recomputing unchanged bounds.'}], [{'type': 'paragraph', 'content': 'Reduce the overhead of iterating through all world subsystems and calling their UpdateStreamingState. Now, only world subsystems that implement\xa0<code class="inline-code">IStreamingWorldSubsystemInterface</code>\xa0will be iterated through.'}]]}]


## 


### 

- [{'type': 'paragraph', 'content': 'LogLevel'}]
- [{'type': 'paragraph', 'content': 'LogLevelStreaming'}]
- [{'type': 'paragraph', 'content': 'LogLevelInstance'}]
- [{'type': 'paragraph', 'content': 'LogLevelStreamingProfiling'}]
- [{'type': 'paragraph', 'content': 'LogLevelTools'}]
- [{'type': 'paragraph', 'content': 'LogStreaming'}]
- [{'type': 'paragraph', 'content': 'LogWorldPartition'}]


### 


### 


### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/Oajo/unreal-engine-performance-profiling-primer">Profiling Primer</a>'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/6XW8/unreal-engine-the-great-hitch-hunt-tracking-down-every-frame-drop">The Great Hitch Hunt: Tracking Down Every Frame Drop</a>'}]


## 


### 

- [{'type': 'paragraph', 'content': 'World Partition enabled levels enforce the use of this feature and cannot opt out of it.'}]
- [{'type': 'paragraph', 'content': 'Non-partitioned worlds do not use this feature by default and can choose to toggle it through the\xa0<code>Use External Actors</code>\xa0option found under\xa0<code>World Settings &gt; World</code>.\xa0\xa0'}]

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide#ofpa-onefileperactor">World Building Guide - OFPA</a>'}]


### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/referencing-assets-in-unreal-engine">Referencing Assets</a>'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/kx/unreal-engine-all-about-soft-and-weak-pointers">All About Soft and Weak Pointers</a>'}]


### 


#### 


##### 


##### 

- [{'type': 'paragraph', 'content': 'The source level that the actor is from will spawn the same actor again once reloaded, which could cause unwanted duplicates.'}]
- [{'type': 'paragraph', 'content': 'If the target level to which the actor was transferred is destroyed, then so is the actor. When the target level is reloaded, it will not respawn that actor since the actor was not cooked into it.'}]


#### 


### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">/Game/Maps/map_MyLevelInstanceMap_LevelInstance_ee8817809499a469_1.map_MyLevelInstanceMap:PersistentLevel.StaticMeshActor_0</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">/Game/Maps/map_MyLevelInstanceMap_LevelInstance_03f9a979b9028f3a_1.map_MyLevelInstanceMap:PersistentLevel.StaticMeshActor_0</code>'}]


### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Engine/ULevelStreaming?application_version=5.5">ULevelStreaming</a>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">ULevelStreaming::OnLevelLoaded</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">ULevelStreaming::OnLevelUnloaded</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">ULevelStreaming::OnLevelShown</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">ULevelStreaming::OnLevelHidden</code>'}]]}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Streaming/FLevelStreamingDelegates?application_version=5.5">FLevelStreamingDelegates</a>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">FLevelStreamingDelegates::OnLevelStreamingTargetStateChanged</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FLevelStreamingDelegates::OnLevelStreamingStateChanged</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FLevelStreamingDelegates::OnLevelBeginMakingVisible</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FLevelStreamingDelegates::OnLevelBeginMakingInvisible</code>'}]]}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Engine/FWorldDelegates?application_version=5.5">FWorldDelegates</a>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<code class="inline-code">FWorldDelegates::LevelAddedToWorld</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FWorldDelegates::PreLevelRemovedFromWorld</code>'}], [{'type': 'paragraph', 'content': '<code class="inline-code">FWorldDelegates::LevelRemovedFromWorld</code>'}]]}]


### 


### 


####