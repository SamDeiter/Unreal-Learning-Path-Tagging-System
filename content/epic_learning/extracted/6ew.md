# Getting Started with Texture Graph

*Learn about the experimental texture graph editor*


## Getting Started with Texture Graph

Get started exploring the experimental texture graph editor.  This  tutorial introduces the basic layout and functionality of the texture graph editor


### What is Texture Graph

Textures are part of the core process forcreating experiences in Unreal Engine. Textures are primarily used in materials and UI. They can be applied directly as an input, like base color, or used as a mask or the RGBA values can be utilized in other calculations. Textures can be unique to an asset or tiled.

Materials may use  several textures that are all sampled and applied for different purposes. For instance, a simple material may have a Base Color texture, a Specular texture, and a Normal Map texture. In addition, there may be a map for Emissive and Roughness stored in the alpha channels of one or more of these same textures. Packing multiple values in a single texture allows them to be used more readily while saving draw calls for performance and reducing disk space.

Texture Graph provides artists an interface to create or edit texture assets directly inside the Unreal Engine without the need for an external image editing package. Utilizing a familiar node graph similar to the Material Editor, a range of nodes can be connected to output textures. You can combine texture graphs with blueprints, materials, and material functions for unique workflows that are only possible within the Unreal Engine.

The Texture Graph is designed for creation and editing texture assets. It is works in conjunction with the texture asset editor which provides additional controls for managing the texture asset.

Texture Asset Editor documentation


### Loading the Plugin

The Texture Graph Editor is an experimental plugin that is not loaded by default when starting the engine. To start using the editor, first enable the plugin.

- Locate the TextureGraphEditor plugin in Edit > plugins
Locate the TextureGraphEditor plugin in Edit > plugins

- Select TextureGraphEditor > Restart Unreal
Select TextureGraphEditor > Restart Unreal


### Creating a New Graph

To create a new texture graph, select the Content Browser's Add button or right-click on empty space in the content browser and select Texture > Texture Graph. This creates a texture graph asset in the current folder.


### Texture Graph UI


### Main Menu - 1

The Main Menu bar contains quick access to important graph management items like save, and open. The tool bar also has several graph specific tools.

- Save- Saves the current graph.
Save- Saves the current graph.

- Open- Opens a graph from your content folder.
Open- Opens a graph from your content folder.

- Export- The export tool opens the export window which controls the graphs final texture export. This window allows you to control which of the outputs in the graph get exported, you can choose to export just a single output or multiple textures if they exist.
Export- The export tool opens the export window which controls the graphs final texture export. This window allows you to control which of the outputs in the graph get exported, you can choose to export just a single output or multiple textures if they exist.

- Update- When Auto Update is not toggled on, the update tool will update the graph thumbnails and output previews. This can be useful for complex graphs where the auto updating can be slow.
Update- When Auto Update is not toggled on, the update tool will update the graph thumbnails and output previews. This can be useful for complex graphs where the auto updating can be slow.

- Auto Update- The auto update toggle turns the graph auto update on or off. Depending on the complexity of the graph you may decide to toggle this option off.
Auto Update- The auto update toggle turns the graph auto update on or off. Depending on the complexity of the graph you may decide to toggle this option off.

- Palette- Displays the palette of nodes.
Palette- Displays the palette of nodes.

- Node Histogram- Displays the node histogram, the histogram provides valuable information about the texture distribution of values.
Node Histogram- Displays the node histogram, the histogram provides valuable information about the texture distribution of values.


### Node Palette - 2

The Node Palette contains all of the available nodes for use inside your texture graph, you can scroll through the graph or use the search bar to find a specific node. To add a node, drag a node from the library into your main graph view. You can also accessthe node library with the RMB in the graph window. Nodes can also be created by dragging a connection from an existing node’s pins. This workflow has the advantage of creating the node connection once the node is placed. The node's connections are made from the initial pin to the first open input pin on the new node.


### Main Graph - 3

The Graph window is the primary view for assembling your graph. Nodes can be positioned anywhere on the graph. In general, input and creation nodes are placed on the left, and the flow of the graph proceeds to the right, ending with output nodes that control what textures get written. You can have a single output or multiple outputs from a graph.


### Texture Preview - 4

The Texture Preview displays the texture of the selected node. The preview has options for viewing specific channels andadjusting the zoom level of the texture. The preview can be locked if you need to view a specific node while other nodes are adjusted. For example, locking the view to the final output but adjusting a blend parameter earlier in the graph.


### Details Panel - 5

The Details panel contains the properties for the currently selected node.


### Viewport Preview - 6

The 3D viewport displays the selected output map on a standard or user defined 3d mesh. The mesh can be defined by dragging the mesh asset directly into the view or by selecting the mesh asset and applying it with the custom mesh icon (teapot)

The visible map can be selected from the viewport details panel.


### Histogram


### Nodes

The new node design for texture graph provides relevant information in a compact layout. With this layout artists can traverse the graph quickly and evaluate the flow of data easily. The node header shows the name or type of node. Nodes are colored based on type of operation. Below the name, is information about the image format of the node and the current resolution. The node header also contains a thumbnail preview.

When expanded, all of the attributes of a node are exposed. This may include node specific attributes or only output settings for the node. In general these values are automatically set based on the evaluation of the graph. In some cases you may want to define custom settings instead of the values.


### Materials

Unreal Engine has an extremely powerful material system. The texture graph can leverage the material system by evaluating materials to create textures that can be utilized in the graph. A material such as the standard concrete material can be loaded into a material node. You can then define the rendered attribute.


### Material Functions

The Texture Graph Editor can use some material functions directly. The material function node  exposes the input pins and attributes available from the material function. This can be extremely useful, allowing for the quick development of a graph without the need to recreate complex functions that may already exist. This allows the texture graph to leverage the robust material function library and toolset.

For example, the texture bombing material function can quickly be integrated to give more random repeating of a texture when compared to a simple repeat available in transform.


### TextureGraph Subgraphs

TextureGraphs can be reused as a subgraph via the texturegraph node. This can be extremely useful for custom repeated operations. For example, adding some noise to a mask. The subgraph can contain a series of nodes to create a complex noise pattern with some specific variables controllable via scalar values.

When the texturegraph node is used the specified inputs areexposed along with any outputs defined in the subgraph. This allows for the development and reuse of common  operations.


### Texture Graph and Blueprints

When combined with blueprints a texture graph can be used for a wide range of pipeline related functions that can streamline common tasks.

With the Texture Graph Editor plugin loaded, you will get additional functions in the blueprint graph palette. With these functions an existing graph can be controlled easily. For example, you can have a basic texture graph that creates a common UV checker pattern.

The following Get and Set nodes all have a World Context Object (optional), a Texture Script Reference Input, and a Parameter Name variable of Name type (which needs to match the Texture Graph’s Input and Output node name).


### Get and Set Nodes

Returns a single precision Float.

Returns a Linear Color Structure (break to get individual Vector4 components).

Returns a Linear Color Structure.

Returns a Texture Object Reference.

Returns Width and Height Integers and a TG Output Settings Structure.

Takes a Single precision Float.

Takes a Linear Color Structure (Vector4).

Takes a Linear Color Structure.

Takes a Texture Object Reference.

Takes the following variable inputs :- Width : Integer- Height : Integer- File Name : Name- Path : Name- Format : ETG_TextureFormat Enumerator- Texture Type : ETG_TexturePresetType Enumerator- LODTexture Group : TextureGroup Enumerator- Compression : TextureCompressionSettings Enumerator- SRGB : Boolean


### Async export nodes

The following nodes have a Texture Graph Object Reference input.

Asynchronously Exports all the Outputs of the Texture Graph referenced into Texture assets.

Takes a Boolean to force overwriting when exporting the Texture(s).

Renders Texture Graph Outputs to an array of Texture Render Target 2D References.

- Asset Creation
- Games
- Film & TV
- Architecture
- Visualization
- Virtual Production

## Course Lessons (3 total)

- Overview of Texture Graph
- Making your First Texture Graph
- Texture Graph Node Reference