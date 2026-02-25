# Avoiding Hitches in Networking

*Guidance on ways to optimize a project's replication in order to avoid slowdowns such as hitches and bandwidth saturation.*

## 


### 

- [{'type': 'paragraph', 'content': 'Grid Spatialization 2D'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This node routes actors into “Grid Cell” child nodes based on the actor’s location, and it includes different handling for dynamic, static, and dormant actors. The node uses the position of the connection’s player to determine which cells should have their actors replicated on that connection.'}]]}]
- [{'type': 'paragraph', 'content': 'Dynamic Spatial Frequency'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This node allows the project’s Replication Graph implementation to define zones for the player’s field of view (e.g. in front of, just outside of, or behind the player’s FOV). The project can then set what the replication frequency of the node’s actors should be based on their distance from the player and which zone they are in. It is also possible to use dynamic spatial frequency nodes as the child nodes of a grid spatialization node, rather than grid cell nodes.'}]]}]
- [{'type': 'paragraph', 'content': 'Always Relevant'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Actors marked bAlwaysRelevant=true will be routed here.'}]]}]
- [{'type': 'paragraph', 'content': 'Always Relevant To Connection'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Actors routed here will always be relevant to the node’s connection. By default, this only gathers the connection’s player controller and pawn.'}]]}]
- [{'type': 'paragraph', 'content': 'Actor List Frequency Buckets'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This node contains multiple actor lists and will gather actors from each of these “buckets” on alternating frames. This can be very useful for actors that should be consistently replicated, such as PlayerStates, as it allows the server to manage how many of these actors are gathered each update while ensuring the clients still regularly receive updates for these actors.'}]]}]


### 


## 


### 


```

```


```

```


## 


## 


### 


## 


## 


## 


##