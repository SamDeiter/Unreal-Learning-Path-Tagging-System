# Level Streaming Hitching Guide

*Guide to recognizing common level streaming hitches in your Unreal Insights captures and tips and links to resources to address them. Hitches refers to any work on the Game Thread or Render Thread causing a frame to go over its time budget and thus preventing a smooth frame rate. Level streaming involves many tasks including environment and gameplay actor loading, physics and rendering setup, garbage collection and game code that each can cause the frame to go over budget.*

### 

- [{'type': 'paragraph', 'content': 'UE 5.6 made important optimizations to level-streaming, including experimental features: <a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide#:~:text=un%2Dnecessary%20calls-,Asynchronous%20physics%20state%20creation,-/destruction">asynchronous physics state creation</a> and <a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide#:~:text=s.PriorityLevelStreamingActorsUpdateExtraTime-,Fast%20Geometry%20Streaming%C2%A0,-The%20FastGeo%20Streaming">Fast Geo</a>. The experimental features are disabled by default.'}]
- [{'type': 'paragraph', 'content': 'UE 5.5 made\xa0<code class="inline-code">UWorld::BlockTillLevelStreamingCompleted</code> faster by utilizing selective <code class="inline-code">FlushAsyncLoading</code>. World partition falls back to blocking level-streaming based on streaming performance, for example, when the player gets too close to a level that\'s still being loaded.'}]
- [{'type': 'paragraph', 'content': 'UE 5.2 introduced <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine">PSO precaching</a> as opt-in feature. UE 5.3 enabled it by default. Coverage of cases is continuously being improved.'}]
- [{'type': 'paragraph', 'content': 'UE 5.2 introduced the <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview">Procedural Content Generation (PCG)</a> framework as experimental. PCG is production-ready as of UE 5.7.'}]
- [{'type': 'paragraph', 'content': 'UE 5.1 made synchronously loading assets from game code <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5.1-release-notes?application_version=5.1#:~:text=When%20sync%20loading%20a%20package">much less punishing</a> via selective <code class="inline-code">FlushAsyncLoading</code> by ZenLoader. During level-streaming it will always be best to avoid synchronous loading.'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/paths/Rkk/unreal-engine-unreal-performance-optimization-learning-path">Unreal Performance Optimization Learning Path</a>: A collection of many optimization tutorials by Epic Games.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/6XW8/unreal-engine-the-great-hitch-hunt-tracking-down-every-frame-drop">The Great Hitch Hunt</a>:\xa0An Unreal Fest talk that covers many causes of hitches, including level streaming hitches.'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=BdopUm1_1_E">Streaming Improvements for Dense Worlds in The Witcher 4 UE5 Tech Demo</a>: An Unreal Fest talk in collaboration with <a href="https://www.cdprojektred.com/en">CD Projekt Red</a> that\xa0discusses features that you should consider to improve level streaming performance, including FastGeo and Unified Streaming Budget.'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=ZRaeiVAM4LI">Performance Optimization for Environments</a>:\xa0An Inside Unreal livestream with countless tips from a tech art point of view, some of which (LODs and Merging Actors) are relevant to level streaming performance.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/qB5K/unreal-engine-level-streaming-deep-dive">Level Streaming Deep Dive</a>: Explanation of UE\'s level streaming system, streaming states, and debugging tips.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/knowledge-base/r6wl/unreal-engine-world-building-guide">World Building Guide</a>: An article containing engine history, quick start guides, and good practices on world-building tools.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/opWW/unreal-engine-profiling-game-memory-and-performance">Profiling Game Memory and Performance</a>: An article with\xa0many general profiling tips.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/qEzo/unreal-engine-profiling-with-purpose-performance-lessons-from-a-real-unreal-project">Profiling with Purpose: Performance Lessons from a Real Unreal Project</a>: An example profiling session presented at Unreal Fest.'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=xIQI6nXFygA">Collision Data in UE5: Practical Tips for Managing Collision Settings & Queries</a>: An Unreal Fest presentation by\xa0<a href="https://www.studiogobo.com/">Studio Gobo</a>\xa0about optimizing collision settings.'}]


#### 


#### 


#### 


#### 


```

```


#### 


#### 


```

```


#### 


```

```


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=7dn6UOrOgyg">Do You Need PCG?</a> (djuD)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=LMQDCEiLaQY">Introduction to PCG Workflows</a> (Epic)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=TbNZ4GKaTow">PCG: Introduction Use Cases, and Production Best Practices</a>\xa0(Epic)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=ncokCVoN-oU&pp=ygUPdW5yZWFsIGZlc3QgcGNn">PCG: First Steps to Advanced Development</a>\xa0(Epic)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=j3ke6MmcaeY">PCG: Advanced Topics & New Features</a> (Epic)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=Bh8QJqhJU94">Leveraging PCG for Building and City Creation</a>\xa0(Virtuos)'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=icIFFlOyob4&t=2s&pp=ygUPdW5yZWFsIGZlc3QgcGNn">Runtime PCG in the Witcher 4 UE Tech Demo</a> (CDPR & Epic)'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/using-pcg-with-gpu-processing-in-unreal-engine">Using PCG with GPU Processing</a> (Epic)'}]


### 


#### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Consoles generally have less cores than PCs'}]
- [{'type': 'paragraph', 'content': 'Developer machines are generally much stronger than the targeted minimum spec'}]


#### 

- [{'type': 'paragraph', 'content': 'Actors and components<b>\xa0</b>may re-enter play: the same object can go through <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-actor-lifecycle">multiple BeginPlay-EndPlay cycles</a>. Game code that isn\'t written with multiple cycles in mind (doing things on EndPlay that aren\'t re-initialized on BeginPlay) is a class of bugs.'}]
- [{'type': 'paragraph', 'content': "When profiling, be aware that when a streaming level is reused, it becomes visible much faster than when it's loaded from disk, because the objects (the level, actors, and components) still exist in memory."}]


### 


#### 

- [{'type': 'paragraph', 'content': "Time spent async loading on the async loading thread, which doesn't directly cause a hitch, but a long async loading task allows players to move closer to the content being loaded. That can appear as visual popping: level sections becoming visible in the player's view. Overlapping with other tasks makes those tasks take longer to complete, too."}]
- [{'type': 'paragraph', 'content': 'Time spent registering actors, components, and creating their physics states on the game thread.'}]
- [{'type': 'paragraph', 'content': 'Time spent calculating initial overlaps is a related hitch discussed further below.'}]
- [{'type': 'paragraph', 'content': 'Unoptimized object counts significantly affect garbage collection performance.'}]

- [{'type': 'paragraph', 'content': 'Async thread AsyncLoadingTime: 14.0 ms -&gt; 4.6 ms'}]
- [{'type': 'paragraph', 'content': 'Game thread AddToWorld time: 132.3 ms -&gt; 23.3 ms'}]
- [{'type': 'paragraph', 'content': 'Game thread RemoveFromWorld time: 133.6 ms -&gt; 28.2 ms'}]


```

```


#### 

- [{'type': 'paragraph', 'content': 'If you constructed these ISMs yourself, break the ISMs up into smaller ones with fewer instances each.'}]
- [{'type': 'paragraph', 'content': "If the ISMs are part of a Packed Level Actor blueprint, consider breaking the PLA up into smaller ones. As a rule of thumb, PLAs shouldn't be larger than the world partition grid cell size, because that makes them more likely to be promoted to higher grid levels and makes their content be streamed in too early."}]
- [{'type': 'paragraph', 'content': 'Instanced meshes placed with the Foliage tool are world partitioned by default. If your world is highly dense, consider using a smaller world partition grid size so that ISM components each cover a smaller area and end up with fewer instances.'}]
- [{'type': 'paragraph', 'content': 'Editor-time PCG placed meshes are not world partitioned by default, but can be. Follow the documentation for <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/using-pcg-generation-modes-in-unreal-engine#using-partitioned-generation">Partitioned Generation</a>.'}]


```

```


#### 


```

```


#### 

- [{'type': 'paragraph', 'content': 'When a physics state is being created async for a component, a write lock is acquired in order to update the physics scene.'}]
- [{'type': 'paragraph', 'content': 'When the game thread performs scene queries, a read lock must be acquired. Although parallel queries are possible, all queries are stalled while something is writing to the physics scene.'}]

- [{'type': 'paragraph', 'content': 'Make components cheaper to async register, adding more granularity for the game thread to do work in-between.'}]
- [{'type': 'paragraph', 'content': 'Configure a time limit\xa0<code class="inline-code">p.Chaos.AsyncPhysicsStateTask.TimeBudgetMS</code>\xa0(default: 0, no limit) for the async register task so the latter part of a game frame is contention-free.\xa0 \xa0\xa0'}]
- [{'type': 'paragraph', 'content': 'Advanced engine modifications for more granular locking in physics body registration code.'}]


```

```


#### 

- [{'type': 'paragraph', 'content': 'You haven\'t configured a time limit\xa0<code class="inline-code">p.Chaos.AsyncPhysicsStateTask.TimeBudgetMS</code>. By default, no time limit is set.'}]
- [{'type': 'paragraph', 'content': 'The configured <code class="inline-code">p.Chaos.AsyncPhysicsStateTask.TimeBudgetMS</code> is so high that it allows for too many components or FastGeo instances to buffered per tick.'}]
- [{'type': 'paragraph', 'content': 'A component has so much collision data (ISM with many instances, or complex SM) that the workload from that component is enough to cause a costly push to the physics scene.'}]


```

```


#### 


#### 

- [{'type': 'paragraph', 'content': '<b>Perform Reachability Analysis:</b>\xa0Mark which objects are still being referenced directly or indirectly from a root set of objects. This involves exploring all object references.'}]
- [{'type': 'paragraph', 'content': '<b>Gather Unreachable Objects:</b>\xa0Iterates the global\xa0<code class="inline-code">GUObjectArray</code>\xa0multithreaded with <code class="inline-code">ParallelFor</code> and gathers the objects that were not marked as still reachable.'}]
- [{'type': 'paragraph', 'content': '<b>Incremental Purge Garbage:</b>\xa0Removes them from the global\xa0<code class="inline-code">GUObjectArray</code>, class maps and other managed places. Calling the object\'s <code class="inline-code">BeginDestroy()</code> function if it hasn\'t been called yet. Freeing up the memory. This task is time sliced: it can take place over multiple frames, so is not a performance worry.'}]

- [{'type': 'paragraph', 'content': 'Represent runtime level content with fewer <code class="inline-code">UObjects</code>, such as replacing <code class="inline-code">StaticMeshActors</code> and <code class="inline-code">StaticMeshComponents</code> with FastGeo or <code class="inline-code">InstancedStaticMeshComponents</code>. ISMCs can also be transformed into FastGeo.'}]
- [{'type': 'paragraph', 'content': 'Streaming in level content later, while for example displaying far-away environment as <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/hierarchical-level-of-detail-overview-in-unreal-engine">HLODs</a>.'}]
- [{'type': 'paragraph', 'content': 'Having fewer assets loaded in memory with efficient memory management. See <a href="https://dev.epicgames.com/community/learning/tutorials/opWW/unreal-engine-profiling-game-memory-and-performance">Profiling Game Memory and Performance</a>.'}]
- [{'type': 'paragraph', 'content': 'Implementing your game systems with fewer use of custom <code class="inline-code">UObjects</code>, for example, using (Unreal) structs instead.'}]
- [{'type': 'paragraph', 'content': "Cleaning up unloaded level content sooner, instead of keeping it in memory. This is a balancing act which we'll discuss now."}]

- [{'type': 'paragraph', 'content': '<b>Fast path:</b>\xa0Streamed out levels that are still in memory can be reactivated cheaply when the player backtracks, but they occupy memory and add to garbage collection times. When many levels are streamed out but still in memory, this can add up considerably to garbage collection times. A reused level means actors and\xa0components go through multiple <code class="inline-code">BeginPlay-EndPlay</code> cycles.'}]
- [{'type': 'paragraph', 'content': '<b>Slow path: </b>When a streamed-out level has been garbage collected and the player returns, the level must be constructed again. This involves async loading the level packages, constructing <code class="inline-code">UObjects</code>, deserializing their data, and running <code class="inline-code">PostLoad</code> functions. This is slower than reusing the level.'}]


#### 

- [{'type': 'paragraph', 'content': 'Is the faraway content allowed to be visible, and the actors ticking?'}]
- [{'type': 'paragraph', 'content': 'Do you prefer paying the AddToWorld cost ahead of time incrementally, or synchronously later on teleportation?'}]


#### 

- [{'type': 'paragraph', 'content': 'One specific actor\'s <code class="inline-code">BeginPlay</code> is too costly, or'}]
- [{'type': 'paragraph', 'content': 'Multiple actors\' <code class="inline-code">BeginPlay</code> are executed in a row that together overshoot the time limit.'}]

- [{'type': 'paragraph', 'content': 'A resource manager actor spawning initial resource actors'}]
- [{'type': 'paragraph', 'content': 'Procedurally spawning initial AI NPCs and critters'}]
- [{'type': 'paragraph', 'content': "Characters spawning ability, inventory and visual actors related to their loadout and running their initialization logic, still while inside the level streamed character's BeginPlay"}]
- [{'type': 'paragraph', 'content': 'World subsystems spawning multiple actors on world initialization'}]


#### 


```

```


#### 

- [{'type': 'paragraph', 'content': 'Loading the asset and its dependencies may take significant time that eats into your frame budget.'}]
- [{'type': 'paragraph', 'content': 'More asset loading requests may be in flight. The async loading thread, which will handle your request, might not get to it right away. This can be bad if many assets are already loading.'}]

- [{'type': 'paragraph', 'content': 'In C++ <b><code class="inline-code">FSoftObjectPath::TryLoad()</code></b> and <b><code class="inline-code">FSoftObjectPtr::LoadSynchronous()</code></b> both trigger a synchronous load.'}]
- [{'type': 'paragraph', 'content': 'In blueprint <b><code class="inline-code">Load Asset Blocking</code></b>\xa0and <b><code class="inline-code">Load Class Asset Blocking</code></b>\xa0are synchronous loads.'}]


```

```


```

```


#### 

- [{'type': 'paragraph', 'content': 'Select the time range of a suspiciously long task and check other threads. Visually try to line up the task with a task on another thread.'}]
- [{'type': 'paragraph', 'content': 'For some timers, enabling the <b><code class="inline-code">-trace=task</code></b> channel reveals which task on another thread is being waited on when you select a timer in Insights and follow the rendered arrows.'}]
- [{'type': 'paragraph', 'content': 'In other cases you may have to inspect the engine code where the timer is defined to see what the function will wait for.'}]


#### 


```

```


###