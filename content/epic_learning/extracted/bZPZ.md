# Chaos Visual Debugger - User Guide for UE 5.5

*User Guide for the Beta release of the Chaos Visual Debugger for UE 5.5. The tool to Debug Physics in Unreal Engine*

### 


### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#scenequerybrowser">Scene Query Browser</a>: Now you can see all scene queries made in any given frame, search by tag name, type, etc. In a new dedicated, Scene Outliner like window.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#recordedlogbrowser">Recorded Output log</a>: CVD is now able to show the recorded output log, similar to how Unreal Insights does it. When you scrub to any frame within CVD, the correct log line will be selected and visualized. In addition, when you select any log line, the corresponding frame will be visualized.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#tracksyncmodes">Network Tick Sync mode</a>: In PIE Sessions, CVD was already able to record server and client data, but they were synchronized using timestamps. In 5.5, we are introducing a new “Network Tick” sync mode, that will calculate and apply the required offsets to show the visualization as the expected state taking into account client side prediction. In this mode, any divergence you see between server and client, is a network de-sync.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#collisiongeometryinspector">Collision Geometry Inspector</a>: A new details panel that allows you to see recorded data per collision geometry (not just from a whole particle /\xa0 rigid body). This panel under the hood processes all the chaos data and decodes it back to settings used in the Unreal Editor. For example, it shows if a shape is query only, query and physics, etc. Collision channel and Collision Channel response matrix'}]
- [{'type': 'paragraph', 'content': '<b>Recent Files:</b> Now the last 5 files opened in CVD are remembered and can be assessed via the File menu.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#accelerationstructuresvisualizationflags">Acceleration Structures</a>: CVD now records and visualizes the acceleration structure used by our scene query system.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#charactergroundconstraintsvisualizationflags">Character Ground Constraints</a>: We added support to record & visualize character ground constraint data. This is the constraint type used by our Physics Based Character Movement system'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#genericdebugdrawvisualizationflags">Generic Debug Draw</a> : Now you can record simple shapes (Sphere, Boxes, Lines) using Macros in C++ or dedicated BP nodes in Blueprints, that then will be visualized with the rest of the simulation in CVD.'}]


#### 

- [{'type': 'paragraph', 'content': '<b>Performance</b>: On the fly geometry generation was improved by removing work, and moving more of the remaining work into worked threads. We will continue improving this area in future releases'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#showbutton">Show Menu</a>: In 5.5, we have re-made the Show menu to be a proper UE tool menu, and added save support. Now all available visualization flags are organized in submenus and sections. Also, when you change a flag, the new setting is auto-saved (you can revert to default if needed).'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#particlecolorization">Particle colorization scheme</a>: In UE 5.4 we were using the color scheme used by Chaos Debug Draw. That color set is good for wire-frame representations, but it is not ideal for solid representation. UE 5.5 now uses a less intense color scheme, which can be changed if desired.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/bZPZ/unreal-engine-chaos-visual-debugger-user-guide-ue-5-5#scenequeries">Scene queries</a>: The scene query inspector now decodes the collision query response flags to show the collision channel response matrix.'}]


### 


## 


## 


## 


### 


#### 


#### 


#### 


### 


#### 


### 


#### 


#### 


## 


##### 


##### 


## 


##### 


##### 


## 


#### 


#### 


#### 


#### 


##### 


##### 

- [{'type': 'paragraph', 'content': 'Collision Data Visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Scene Queries Visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Particle Data Visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Joints Constraints Data Visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Character Ground Constraints Data Visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Acceleration Structures Data visualization<br>'}]
- [{'type': 'paragraph', 'content': 'Generic Debug Draw Data Visualization<br>'}]


###### 


###### 


###### 


###### 


###### 


###### 


###### 


###### 


###### 


```

```

- [{'type': 'paragraph', 'content': '<b>Tag Name:</b> An FName that will be shown if debug Draw Text is enabled<br>'}]
- [{'type': 'paragraph', 'content': '<b>Owner:</b> Any uobject this debug draw shape will be related to. This is used internally to know if a shape is recorded from a server solver or a client solver<br>'}]


#### 


##### 


##### 


## 


### 


### 


#### 


#### 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Shape Type<br>'}]
- [{'type': 'paragraph', 'content': 'Collision Enabled setting (Query Only, Query and Physics, etc) <br>'}]
- [{'type': 'paragraph', 'content': 'Collision Channel<br>'}]
- [{'type': 'paragraph', 'content': 'Collision Channel response matrix (based on the collision profile used)<br>'}]
- [{'type': 'paragraph', 'content': 'Additional filter data flags<br>'}]


## 


## 


## 


### 


### 


##### 


#### 


#### 


#### 


## 

- [{'type': 'paragraph', 'content': '<b>Landscape Collision representation might be shown incorrectly if between frames the collision is unloaded and the loaded in rapid succession</b> (usually while scrubbing a recording and going trough such event). : This will be fixed in the next hotfix build available for UE 5.5. The<br>'}, {'type': 'paragraph', 'content': '<b>Workaround</b>: One you get into that state, the only workaround is to Reload the CVD file (it can be done using the recent files menu in a few clicks)<br>'}]



## 

- [{'type': 'paragraph', 'content': "<b>Custom Data Filters</b> (Scripting system): CVD records a vast amount of data, but currently CVD's UI is a limiting factor to make use of it. We will be working on a system that allows you to create custom queries to highlight or only show recorded data that matches your query."}]
- [{'type': 'paragraph', 'content': "<b>Support for more types of constraints</b>\xa0:\xa0Currently we don't support Suspension Constraints"}]
- [{'type': 'paragraph', 'content': '<b>Re-Simulation & Re-Query </b>:\xa0 This feature will allow you to re-run the simulation (or Scene Query) from any given frame, inside CVD. This will allow you to test a data change or code change without leaving CVD, resulting in faster iteration times.<br>'}]
- [{'type': 'paragraph', 'content': 'CVD Extension: An API that allows you to create your own plugins or module where you can define your own types for serialization, and your own visualization code.\xa0 This will allow you to record and visualize custom data into CVD from non-engine systems (like simulation code implemented in your the Game module or plugins).<br>'}]