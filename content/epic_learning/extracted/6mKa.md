# Niagara Data Channels Update: NEW Access Contexts in Unreal Engine 5.7

*This document covers various updates to the Niagara VFX Data Channels feature as of the 5.7 Unreal Engine release.*

## 


## 


## 


### 


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'NDCRef (Niagara Data Channel Reference Structure)'}]
- [{'type': 'paragraph', 'content': 'Owning Component (Scene Component Object Reference)'}]

- [{'type': 'paragraph', 'content': 'Force Attach to Owning Component'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If true, will attempt to attach to the owning component if one exists'}]]}]
- [{'type': 'paragraph', 'content': 'Cell Size Override'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'An override for the Cell Size, used for internal routing; Caution: every unique cell size value will create a new data bucket and handler Niagara System. Use with care. This setting can provide flexibility to users, but can cause problems if not done correctly.'}]]}]
- [{'type': 'paragraph', 'content': 'System Bounds Padding'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Padding applied to the bounds of spawned handler systems. Should be large enough to contain any spawned VFX near the edge of a grid cell. When systems are attached to the owning component, bounds are the component bounds + SystemBoundsPadding.'}]]}]
- [{'type': 'paragraph', 'content': 'Gameplay Tag'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Data can optionally be routed by a given Gameplay Tag for additional variation.'}]]}]
- [{'type': 'paragraph', 'content': 'System to Spawn'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'A Niagara System; change this to override the default system used.'}]]}]


```

```


### 


#### 


#### 


## 

- [{'type': 'paragraph', 'content': 'Default System To Spawn'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This defines which Niagara System will be spawned by default in each area the NDC data is written to. This can be overridden in the Access Context when writing to the NDC.'}]]}]
- [{'type': 'paragraph', 'content': 'Cell Size'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The size of each Cell subdivision of the NDC data.  This is effectively the bounds of each Niagara System that will handle the incoming NDC data. This is similar to the Islands NDC in Static Aligned mode.'}]]}]
- [{'type': 'paragraph', 'content': 'Attachment Settings'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This is particularly useful when spawning impact effects or decals on moving objects or characters. You can use this attachment logic to pass in local space hit locations, so that the NDCs can spawn correctly with the hit component.\xa0\xa0'}], [{'type': 'paragraph', 'content': 'The Gameplay Birst NDC can attach to a Niagara handler system and the corresponding NDC data for a specific component. All related data will be unique to that component, rather than being shared in large world space grid cells, as is typical with NDCs. To use this, the owning component must be specified when writing to the NDC, so that it has something to attach to.'}]]}]
- [{'type': 'paragraph', 'content': 'Speed Threshold'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If the owning component is traveling greater than or equal to the speed value specified in this setting, then the Attachment path (outlined above) will be used.'}]]}]
- [{'type': 'paragraph', 'content': 'Gameplay Tags'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': "If the owning component's actor has any of the following gameplay tags, the Attachment path will be used."}]]}]
- [{'type': 'paragraph', 'content': 'Component Tags'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If the owning component is one of the types specified in this setting, the Attachment path will be used.\xa0'}]]}]


##