# Modifying Meshes Upon Import with Geometry Script + Dataprep

*Geometry Script is a powerful plugin that lets you create Blueprints for any kind of model manipulation, like beveling, extruding, booleans, etc. However, it's incompatible with Visual Dataprep, UE's system for automating Datasmith imports. This tutorial provides a framework for how to combine Dataprep recipes and Geometry Script Blueprints with Editor Utility Widgets to create interesting opportunities for modifying incoming meshes.*

## 


## 

- [{'type': 'paragraph', 'content': 'Visual Dataprep'}]
- [{'type': 'paragraph', 'content': 'Editor Utility Widget'}]
- [{'type': 'paragraph', 'content': 'Geometry Script'}]

- [{'type': 'paragraph', 'content': 'Dataprep Editor'}]
- [{'type': 'paragraph', 'content': 'Geometry Script'}]
- [{'type': 'paragraph', 'content': 'Editor Utilities'}]


## 

- [{'type': 'paragraph', 'content': 'A <b>Blueprint Function Library</b> will hold a variety of <b>Geometry Script</b> operations that will modify meshes.'}]
- [{'type': 'paragraph', 'content': 'A <b>Dataprep</b> recipe will tag actors that we wish to modify.'}]
- [{'type': 'paragraph', 'content': 'An <b>Editor Utility Widget</b> will sequentially execute the Dataprep recipe and then run the Geometry Script functions on the tagged meshes'}]


## 


## 


```

```


## 


## 

- [{'type': 'paragraph', 'content': 'We have an input parameter for what <b>Tag</b> to search for.'}]
- [{'type': 'paragraph', 'content': 'We gather <b>all actors</b> in the scene with that tag.'}]
- [{'type': 'paragraph', 'content': '<b>For each actor</b> we gather all <b>static mesh components</b>.'}]
- [{'type': 'paragraph', 'content': '<b>For each component</b> we record a copy of its static mesh <b>asset</b>.'}]
- [{'type': 'paragraph', 'content': 'We also record a list of all components we gathered. (This is useful later)'}]
- [{'type': 'paragraph', 'content': 'Finally, we <b>return the lists</b> of assets and components for whoever calls this function'}]


```

```


## 

- [{'type': 'paragraph', 'content': 'Reimport our latest Datasmith model (this also clears any mesh edits)'}]
- [{'type': 'paragraph', 'content': 'Run the Geometry Script modifications on tagged actors'}]


## 


##