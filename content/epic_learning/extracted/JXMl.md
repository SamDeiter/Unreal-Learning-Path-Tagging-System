# LEGACY - Your First 60 Minutes with Mass

*A legacy guide to serve as a walkthrough of the MassEntity system for first time users in 5.2. It covers the concepts of Mass, key terminology, and how Mass processors work under the hood. This is all tied together by creating Mass agents that behave as wandering pedestrians.*

### 


### 


### 

- [{'type': 'paragraph', 'content': 'MassEntity'}]
- [{'type': 'paragraph', 'content': 'MassGameplay'}]
- [{'type': 'paragraph', 'content': 'MassAI'}]
- [{'type': 'paragraph', 'content': 'MassCrowd'}]
- [{'type': 'paragraph', 'content': 'ZoneGraph (For navigation)'}]
- [{'type': 'paragraph', 'content': 'StateTree'}]


### 


## 


## 

- [{'type': 'paragraph', 'content': '<strong>Entity</strong> - This is the base class of Mass that holds pointers to all of its Fragments'}]
- [{'type': 'paragraph', 'content': '<strong>Fragment\xa0</strong>- Holds the data/state for an Entity in tightly packed arrays (e.g. transform, velocity, current LOD, etc.)'}]
- [{'type': 'paragraph', 'content': '<strong>Archetype\xa0</strong>- Entities with identical Fragment composition that are grouped together. Entity composition can change at runtime resulting in Archetype migration'}]
- [{'type': 'paragraph', 'content': '<strong>Trait\xa0</strong>- Group fragments together and typically represent Entity features (e.g. Movement, ZoneGraph Navigation, SmartObject User)'}]
- [{'type': 'paragraph', 'content': '<strong>Tags\xa0</strong>- Archetype-level, Dataless Fragments that can be used by Queries for filtering archetypes based on their presence or absence'}]
- [{'type': 'paragraph', 'content': '<strong>Chunk Fragment</strong> - Fragments that are applied to a subset of Entities in an Archetype instead of directly to a single Entity'}]
- [{'type': 'paragraph', 'content': '<strong>Shared Fragment</strong> - Fragments with data that are shared with multiple entities for memory optimization purposes'}]
- [{'type': 'paragraph', 'content': '<strong>Processor\xa0</strong>- Where logic execution occurs in Mass. Processors can change values of a Fragment as well as composition of Entities (adding or removing).'}]
- [{'type': 'paragraph', 'content': '<strong>Entity Query</strong> - A query used by processors that filters archetypes based on fragment and/or tag requirements. The EntityQuery returns batches of fragments without regard to the individual Entity identifiers'}]
- [{'type': 'paragraph', 'content': '<strong>Mass Spawner</strong> - System for adding Entities to a level at runtime'}]
- [{'type': 'paragraph', 'content': '<strong>Mass Entity Config</strong> - Asset that defines the Mass agent to spawn by specifying traits of the Entity'}]


## 

- [{'type': 'paragraph', 'content': 'Each processor starts by configuring an entity query which adds requirements of the entity such as tags, fragments, shared fragments, chunk fragments, and even subsystems.'}]
- [{'type': 'paragraph', 'content': 'Processors then batch the updates for the chunk of entities by calling ForEachEntityChunk. This is where Chunk Fragments are used and a single chunk fragment can be used across all of the entities in the chunk.'}]
- [{'type': 'paragraph', 'content': 'The MassEntityQuery matches the requirements with the archetypes and can filter out chunks of matching archetypes based on chunk fragment filters. While the requirements are usually that the tags or fragments are present on the archetype, they can be used to select archetypes without specified tags and fragments.'}]
- [{'type': 'paragraph', 'content': 'After filtering, the Mass Entity Query triggers a function on each chunk of entities, and the individual entities of the chunk can be accessed via the FMassExecutionContext. Most of the plugin code makes use of lambda expressions when executing ForEachEntityChunk.'}]


## 


### 

- [{'type': 'paragraph', 'content': '<strong>MassEntity</strong> - The core plugin for the Mass framework. This is required for any project wanting to use Mass.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Moved into the core engine in 5.5. Plugin is now deprecated as it is no longer needed for MassEntity to work.'}]]}]


### 

- [{'type': 'paragraph', 'content': '<strong>MassGameplay</strong> - This plugin contains specialized content for interacting with the world, replication, LOD, movement, and visualizing Entities in the world. Support for having an Entity represented as an Actor is also included in the plugin with some utilities to prevent stomping data if the Actor or Mass want to alter the agent’s data.'}]
- [{'type': 'paragraph', 'content': '<strong>MassAI\xa0</strong>- Contains logic for behavior such as running StateTrees, navigating the world via ZoneGraph, avoidance of other Mass agents, and replicating the AI.'}]
- [{'type': 'paragraph', 'content': '<strong>MassCrowd\xa0</strong>- This contains specialized classes for creating crowds of Mass entities with special visualization and navigation processors. It was used extensively in the City Sample and built on top of the other Mass plugins.'}]


### 


## 


## 


## 

- [{'type': 'paragraph', 'content': '<strong>Inner Radius</strong> = 1000'}]
- [{'type': 'paragraph', 'content': '<strong>Outer Radius </strong>= 3000'}]
- [{'type': 'paragraph', 'content': '<strong>Number of Rings</strong> = 5'}]
- [{'type': 'paragraph', 'content': '<strong>Points Per Ring</strong> = 12'}]


## 

- [{'type': 'paragraph', 'content': '<strong>DebugVisLocationProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassProcessor_UpdateDebugVis</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassStateTreeActivationProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassStateTreeProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassUpdateISMProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassVisualizationLODProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassVisualizationProcessor</strong>'}]


### 


## 


## 

- [{'type': 'paragraph', 'content': '<strong>MassViewerInfoFragment\xa0</strong>- this fragment stores the calculated distance to viewers that will be used when calculating the LOD level'}]
- [{'type': 'paragraph', 'content': '<strong>TransformFragment\xa0</strong>- this fragment stores the world transform for the entity'}]
- [{'type': 'paragraph', 'content': '<strong>MassActorFragment\xa0</strong>- this fragment holds a pointer to the AActor in the world that is used to represent the entity with the visualization trait'}]


## 

- [{'type': 'paragraph', 'content': '<strong>MassCrowdLODCollectorProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassCrowdVisualizationProcessor</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>MassCrowdVisualizationLODProcessor</strong>'}]


## 


### 


## 


## 


### 


## 


## 


## 

- [{'type': 'paragraph', 'content': '<strong>Movement\xa0</strong>- Allows for movement parameters to be set for the entity. The parameters can be different speeds and modes of movement. Parameters can be added and removed in <strong>Project Settings-&gt;Mass-&gt;Mass Movement</strong>'}]
- [{'type': 'paragraph', 'content': '<strong>Steering\xa0</strong>- Allows for parameters to be set that control steering behavior such as reaction times, speed thresholds, and move target selection cooldowns'}]
- [{'type': 'paragraph', 'content': '<strong>Smooth Orientation</strong> - Allows for the direction of movement to be set with weights for how quickly it should turn and how much it wants to keep its direction while moving'}]
- [{'type': 'paragraph', 'content': '<strong>Avoidance\xa0</strong>- Allows for agents to avoid obstacles. The parameters associated with this concern distance to detect obstacles, amount of clearance for avoiding obstacles, and the length of time to look ahead for avoidance.'}]


## 


## 


## 


## 


## 


### 


## 


##