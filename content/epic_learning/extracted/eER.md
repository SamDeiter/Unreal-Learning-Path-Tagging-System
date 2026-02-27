# Technical Guide To Linear Content Creation: Production

*An overview on production using a real-time workflow for linear content creators.*


## Overview of Production

Real-time production for linear content creators.

While it is nice to plan and speculate about how to get things done for a project or a production, it is now time to jump in and make things happen.

To give you and your team a bird’s eye view of how to make stunning visuals in Unreal Engine as well as some of the features available, we recommend reviewing the following documentation:

- Designing Visuals, Rendering, and Graphics In Unreal Engine
Many of the same topics will be covered in this course, however we put this course together to provide more detail in key areas where teams in the past have run into issues.

The Course on Production will cover:

- Data Acquisition
Lidar
Photogrammetry
- Lidar
- Photogrammetry
- Multi-User Sessions & SwitchboardSwitchboard
- Switchboard
- Asset Optimization & Development for Real-TimeOptimized Workflows
- Optimized Workflows
- World Building
Building Virtual Worlds
Blocking and Asset Production
Procedural Content Generation ( PCG )
Additional World Building Tips & Tricks
3rd Party World Building Tools
- Building Virtual Worlds
- Blocking and Asset Production
- Procedural Content Generation ( PCG )
- Additional World Building Tips & Tricks
- 3rd Party World Building Tools
- Modeling
Unreal Engine Modeling Tools
Geometry Script (experimental)
Tessellation and Displacement
LODs
Nanite
Modeling Optimizations
- Unreal Engine Modeling Tools
- Geometry Script (experimental)
- Tessellation and Displacement
- LODs
- Nanite
- Modeling Optimizations
- Look Development
Texturing
Virtual Texturing
UDIMs
Texture Channel Packing
Texture Atlases
Quixel Bridge & Quixel Megascans
Quixel Mixer - For Surfacing & Texturing
Materials
Legacy Materials
Substrate
Material Optimizations
Stylization and Stylized Materials


Variants
Look Development Optimizations
- Texturing
- Virtual Texturing
- UDIMs
- Texture Channel Packing
- Texture Atlases
- Quixel Bridge & Quixel Megascans
- Quixel Mixer - For Surfacing & Texturing
- Materials
Legacy Materials
Substrate
Material Optimizations
Stylization and Stylized Materials
- Legacy Materials
- Substrate
- Material Optimizations
- Stylization and Stylized Materials
- Variants
- Look Development Optimizations
- Rigging & Animation
Rigging & Animation - Rules Of Thumb
Rigging & Animation - Gotchas
Importing Animation
Skeleton/Animation IO
FBX Animation Pipeline
Animating Characters and Objects
Blend Shapes/Morph Targets
Machine Learning (ML) Deformers
Control Rig
IK Rig and Animation Retargeting
Building Modular Characters
- Rigging & Animation - Rules Of Thumb
- Rigging & Animation - Gotchas
- Importing Animation
- Skeleton/Animation IO
- FBX Animation Pipeline
- Animating Characters and Objects
- Blend Shapes/Morph Targets
- Machine Learning (ML) Deformers
- Control Rig
- IK Rig and Animation Retargeting
- Building Modular Characters
- Groom (Hair & Fur)Animated Groom Cache
- Animated Groom Cache
- MetaHumans
- Live Link
- Performance Animation and Motion Capture
Performance Capture
Real-Time Performance Capture
Motion Capture
Facial Motion Capture
Virtual Cameras
- Performance Capture
- Real-Time Performance Capture
- Motion Capture
- Facial Motion Capture
- Virtual Cameras
- FX, CFX & Crowds
Niagara
Using Niagara for Linear Content
Niagara Flipbook Baker
Niagara Fluids


VDB Support - Sparse 
Crowds with Niagara
Crowd Animation Tools


Chaos
Additional Resources for FX
SideFX
Vertex Animation
- Niagara
Using Niagara for Linear Content
Niagara Flipbook Baker
Niagara Fluids


VDB Support - Sparse 
Crowds with Niagara
Crowd Animation Tools
- Using Niagara for Linear Content
Niagara Flipbook Baker
Niagara Fluids
- Niagara Flipbook Baker
- Niagara Fluids
- VDB Support - Sparse
- Crowds with Niagara
- Crowd Animation Tools
- Chaos
- Additional Resources for FX
SideFX
Vertex Animation
- SideFX
- Vertex Animation
- Lighting
Deferred vs Forward Shading
Lightmass (UE 4.27)
Lumen (UE 5.0)Lumen and Ambient Occlusion (SSAO)

Path Tracing (UE 4.27 & UE 5.0)
Hybrid Ray Tracing
Post Process Volumes
Create Masks (Custom Stencil Buffers)
Lighting Channels (Light Linking)
Lighting Optimizations
Environment Light Mixer & Environment Lighting
Light Mixer
Object Mixer
- Deferred vs Forward Shading
- Lightmass (UE 4.27)
- Lumen (UE 5.0)Lumen and Ambient Occlusion (SSAO)
- Lumen and Ambient Occlusion (SSAO)
- Path Tracing (UE 4.27 & UE 5.0)
- Hybrid Ray Tracing
- Post Process Volumes
- Create Masks (Custom Stencil Buffers)
- Lighting Channels (Light Linking)
- Lighting Optimizations
- Environment Light Mixer & Environment Lighting
- Light Mixer
- Object Mixer
- Rendering
Movie Render Queue
Render Passes and AOVs
Rendering in Layers (Stencil Layers)
Additional Render Passes (AOVs)
Object IDs (Cryptomatte)


High-Quality Rendering
Deferred or Hybrid Ray Traced Rendering
Path Traced Rendering Samples
Raytrace/Lumen Samples
Console Variables (Cvars)
Console Variables (CVars)- MRQ Game Overrides
Console Variables (CVars) - Minimal CVars For High Quality Rendering
Console Variables (CVars) - Common, Raytracing & Lumen
Console Variables (CVars) - New Lumen 5.1 / 5.2
Console Variables (CVars) - Sky and Atmosphere System
Console Variables (CVars) - PathTracing
Console Variables (CVars) - Virtual Shadow Map Overview
Console Variables (CVars) - Hair & Fur


Console Variable Editor (CVars Editor)


Render Farm & Distributed Rendering
- Movie Render Queue
- Render Passes and AOVs
Rendering in Layers (Stencil Layers)
Additional Render Passes (AOVs)
Object IDs (Cryptomatte)
- Rendering in Layers (Stencil Layers)
- Additional Render Passes (AOVs)
- Object IDs (Cryptomatte)
- High-Quality Rendering
Deferred or Hybrid Ray Traced Rendering
Path Traced Rendering Samples
Raytrace/Lumen Samples
Console Variables (Cvars)
Console Variables (CVars)- MRQ Game Overrides
Console Variables (CVars) - Minimal CVars For High Quality Rendering
Console Variables (CVars) - Common, Raytracing & Lumen
Console Variables (CVars) - New Lumen 5.1 / 5.2
Console Variables (CVars) - Sky and Atmosphere System
Console Variables (CVars) - PathTracing
Console Variables (CVars) - Virtual Shadow Map Overview
Console Variables (CVars) - Hair & Fur


Console Variable Editor (CVars Editor)
- Deferred or Hybrid Ray Traced Rendering
- Path Traced Rendering Samples
- Raytrace/Lumen Samples
- Console Variables (Cvars)
Console Variables (CVars)- MRQ Game Overrides
Console Variables (CVars) - Minimal CVars For High Quality Rendering
Console Variables (CVars) - Common, Raytracing & Lumen
Console Variables (CVars) - New Lumen 5.1 / 5.2
Console Variables (CVars) - Sky and Atmosphere System
Console Variables (CVars) - PathTracing
Console Variables (CVars) - Virtual Shadow Map Overview
Console Variables (CVars) - Hair & Fur
- Console Variables (CVars)- MRQ Game Overrides
- Console Variables (CVars) - Minimal CVars For High Quality Rendering
- Console Variables (CVars) - Common, Raytracing & Lumen
- Console Variables (CVars) - New Lumen 5.1 / 5.2
- Console Variables (CVars) - Sky and Atmosphere System
- Console Variables (CVars) - PathTracing
- Console Variables (CVars) - Virtual Shadow Map Overview
- Console Variables (CVars) - Hair & Fur
- Console Variable Editor (CVars Editor)
- Render Farm & Distributed Rendering
- Compositing
Composure
Compositor Plugin
Nuke's UnrealReader
- Composure
- Compositor Plugin
- Nuke's UnrealReader
- Performance, Profiling, and Debugging
Performance, Profiling, and Debugging Overview
Dealing with GPU crashes
- Performance, Profiling, and Debugging Overview
- Dealing with GPU crashes
- Optimizations
Editor Optimizations
Modeling Optimizations
Look Development Optimizations
Lighting Optimizations
- Editor Optimizations
- Modeling Optimizations
- Look Development Optimizations
- Lighting Optimizations
- Cinematics & Media
- Film & TV
- virtual production
- cinematics
- technical guide to linear content creation

## Course Lessons (19 total)

- Overview of Production
- Data Acquisition
- Multi-User Sessions & Switchboard
- Asset Optimization & Development For Real-Time
- Modeling
- Look Development
- Rigging & Animation
- MetaHumans
- Live Link
- Performance Animation and Motion Capture
- FX, CFX & Crowds
- Lighting
- Rendering
- Compositing
- Performance, Profiling and Debugging
- Optimizations
- Next Course: Training & Additional Resources
- Previous Course: Sequencer
- Home: Technical Guide To Linear Content Creation