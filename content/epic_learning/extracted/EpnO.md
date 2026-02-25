# Chaos Visual Debugger - User Guide for UE 5.4

*User guide for the Beta release of the Chaos Visual Debugger in Unreal Engine 5.4*

### 


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


##### 

- [{'type': 'paragraph', 'content': 'Particle Data'}]
- [{'type': 'paragraph', 'content': 'Scene Queries'}]
- [{'type': 'paragraph', 'content': 'Collision Data'}]
- [{'type': 'paragraph', 'content': 'Joints Constraints'}]


###### 


###### 


###### 


###### 


###### 


###### 


###### 


## 


### 


### 


### 


### 


## 


## 


### 


### 


##### 


#### 


#### 


## 

- [{'type': 'paragraph', 'content': 'The first frame of the recording is not automatically played upon loading. This means that when loading a complex file, you can hit a small delay when trying to scrub or play for the first time since the CVD trace file was loaded.'}]
- [{'type': 'paragraph', 'content': 'Component Scene Queries are not supported. Scene queries against the world are supported, but scene queries done by, for example, calling UPrimitiveComponent::LineTrace are not being recorded at the moment.'}]
- [{'type': 'paragraph', 'content': 'Static Particles created after a recording started can take 10 seconds to appear. This happens because CVD records a full capture every 10 seconds, and then only records what changed between frames. There is a bug where static particles created in that "delta" recording period are missed. We had a fix ready to go and lined up for the next UE release'}]
- [{'type': 'paragraph', 'content': '\xa0 Particles being disabled after the recording started can take 10 seconds to reflect that new disabled state in CVD. This is caused by the same reason as the previous issue, and we also have a fix ready to go for the next release. For this and the previous issue, a partial workaround is to reduce the time interval used to record full captures using the following console command, but it is important to mention this will have a greater performance impact when a recording is active, and more data will be generated resulting in larger CVD trace files. The command is\xa0<code class="inline-code">p.Chaos.VD.TimeBetweenFullCaptures 1</code>'}]


## 

- [{'type': 'paragraph', 'content': "<b>Custom Data Filters</b> : CVD records a vast amount of data, but currently CVD's UI is a limiting factor to make use of it. We will be working on a system that allows you to create custom queries to highlight or only show recorded data that matches your query."}]
- [{'type': 'paragraph', 'content': "<b>Geometry Data Inspector</b> : Each geometry shape has its collision data recorded but currently there is no way to inspect it. This feature will allow you to select a specific shape in a particle's geometry and see its associated collision data"}]
- [{'type': 'paragraph', 'content': "<b>Support for more types of constraints </b>:\xa0Currently we don't support Suspension Constraints or Character Constraints."}]