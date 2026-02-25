# Nanite Assemblies in USD: Part 2 - Houdini Tutorials

*Part 2 of this 2-part series expands on the concepts of representing Nanite Assemblies in USD introduced in Part 1 and demonstrates their practical application in the form of two Houdini tutorials*

- [{'type': 'paragraph', 'content': 'Creating a Static Mesh Nanite Assembly'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This is a simple example of creating a static mesh Nanite Assembly by scattering a couple of simple meshes with a point cloud.'}]]}]
- [{'type': 'paragraph', 'content': 'Creating a Skeletal Mesh Nanite Assembly'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This expands on this concept by including the more complex requirements for creating a basic skeletal mesh Nanite Assembly.'}]]}]


## 


## 

- [{'type': 'paragraph', 'content': 'Create or import all part mesh geometry.'}]
- [{'type': 'paragraph', 'content': 'Create a Point Instancer that duplicates the geometry and positions, scales, and rotates all parts.'}]
- [{'type': 'paragraph', 'content': 'Configure the Nanite Assembly root prim by applying the <code class="inline-code">NaniteAssemblyRootAPI</code> schema'}]


### 


### 


### 


### 


## 

- [{'type': 'paragraph', 'content': 'In addition to <code class="inline-code">PointInstancer</code>, we must author a base <code class="inline-code">SkelRoot</code> prim with a skeleton that we want to use to animate the assembly (See the <a href="https://openusd.org/dev/api/usd_skel_page_front.html">UsdSkel documentation</a> for more info).'}]
- [{'type': 'paragraph', 'content': 'The parts themselves must also be skeletal meshes, which means we are instancing other <code class="inline-code">SkelRoots</code>, not just geometry.'}]
- [{'type': 'paragraph', 'content': 'Each part instance must be bound to at least one joint in the base skeleton so its pivot animates with the base.'}]


### 


### 


```

```


## 


## 


##