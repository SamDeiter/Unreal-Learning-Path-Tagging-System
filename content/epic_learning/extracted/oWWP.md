# Learn Blueprint: Create Elegant Floating Items using Blueprint Part 1

*In part one of this tutorial, you'll build a powerful yet simple ItemFloater Blueprint Actor designed to add subtle, elegant motion to Static Mesh Items showcased in your level. Perfect for enhancing visual interest and cinematic appeal, this flexible tool lets you breathe life into static scenes, adding polish, movement, and easy controls. This detailed tutorial serves as an overview of blueprints in Unreal Editor. I have included many tips and concepts in this tutorial to give you a strong foundation on making Blueprint Actors to use in your experience.*

- [{'type': 'paragraph', 'content': 'Part 1:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Creating the project and an introduction to Blueprints'}], [{'type': 'paragraph', 'content': 'How to create robust Blueprint Actors'}], [{'type': 'paragraph', 'content': 'Step-by-step introduction to making Blueprint Graphs'}], [{'type': 'paragraph', 'content': 'Expose parameters for users to customize within their levels'}], [{'type': 'paragraph', 'content': 'Controlling Timelines and setting their play rate'}]]}]
- [{'type': 'paragraph', 'content': 'Part 2: '}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Extending functionality and Binding and Calling Blueprint Events with the Pawn\xa0'}], [{'type': 'paragraph', 'content': 'Working with Blueprint Components'}], [{'type': 'paragraph', 'content': 'Activation controls and Path Tracer consideration'}]]}]


### 


### 


### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'The user does not need to know Blueprint to work with this object.'}]
- [{'type': 'paragraph', 'content': 'Allow the user to position and adjust the object directly in the level and parent any affected objects as children in the Outliner.'}]
- [{'type': 'paragraph', 'content': 'The user can simply put any number of movable Actors as a child in the outliner of the Blueprint to get the effect.'}]
- [{'type': 'paragraph', 'content': 'The user should have control over the parameters on a per-instance basis.'}]
- [{'type': 'paragraph', 'content': 'The Blueprint should not be overly complicated to achieve the task at hand.\xa0'}]
- [{'type': 'paragraph', 'content': 'This Blueprint is focused on Runtime use cases, not on the in-editor viewport. The VP_TickableActor could be used with the concepts in this tutorial, but it requires more work to set up.'}]
- [{'type': 'paragraph', 'content': 'The Blueprint should be able to be integrated into a system, loosely coupled into the broader systems within our Level.'}]
- [{'type': 'paragraph', 'content': 'The Blueprint Actor should be optionally interactable by the player on a per-instance basis. The method of interaction should be established by the specifics of your experience.\xa0'}]
- [{'type': 'paragraph', 'content': 'The Blueprint should complement the Path Tracer, as often high-quality imagery is created directly from our project.\xa0'}]


#### 


#### 


#### 


#### 


#### 


##### 

- [{'type': 'paragraph', 'content': 'The "Event BeginPlay" event (Red nodes are Events) is triggered exactly one time when the experience is started. This is a good spot to set up components and initialize variables.'}]
- [{'type': 'paragraph', 'content': 'The "Event ActorBeginOverlap" triggers when any Actor overlaps this Actor. This could be a trigger volume or another Actor.\xa0'}]
- [{'type': 'paragraph', 'content': 'The "Event Tick" triggers literally every tick when tick is enabled on the actor. There is also a Tick Interval that should be managed for performance.\xa0'}]
- [{'type': 'image', 'image_id': 70128, 'caption': 'The Class Defaults are available  by selecting the mode button at the top of the Blueprint Panel.', 'alt_text': '', 'image': {'id': 70128, 'file_name': 'image.png', 'file_size': 27187, 'content_type': 'image/png', 'created_at': '2025-06-06T17:35:37.036+00:00', 'height': 142, 'width': 1335, 'storage_key': '1b1360a5-2d1a-4637-a688-e389edb701cf', 'context': 'learning'}, 'storage_key': '1b1360a5-2d1a-4637-a688-e389edb701cf', 'context': 'learning', 'width': None}]
- [{'type': 'image', 'image_id': 70127, 'caption': 'The Actor Class Defaults has the configuration options for the Ticking of the Actor.', 'alt_text': '', 'image': {'id': 70127, 'file_name': 'image.png', 'file_size': 19507, 'content_type': 'image/png', 'created_at': '2025-06-06T17:34:24.295+00:00', 'height': 259, 'width': 913, 'storage_key': 'f162cacb-f8f6-495b-aa0a-ff16ab53b472', 'context': 'learning'}, 'storage_key': 'f162cacb-f8f6-495b-aa0a-ff16ab53b472', 'context': 'learning', 'width': None}]


##### 


#### 


#### 


#### 


#### 


#### 


#### 


#### 


###