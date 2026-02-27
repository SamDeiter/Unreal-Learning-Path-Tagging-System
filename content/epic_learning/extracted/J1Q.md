# DMX: Using MVR and Datasmith

*Take a look at how DMX and Datasmith relate to DMX.*


## DMX: What is MVR?

Let's take a look at what MVR is and how it relates to the current Datasmith workflow.

MVR, or My Virtual Rig (link), is a file format standard used in the Live Events space to share DMX scene data between different tools, such as lighting consoles, visualizers, and CAD programs. This allows the precise placement of DMX fixtures, their configuration using GDTF signatures, and their corresponding patch information, including Universe and Patch Address.

MVR is also used in the Film and TV industry to support the integration of DMX-enabled fixtures in virtual production sets. This support increases collaboration for teams using lighting consoles, such as the Grand MA3, alongside a CAD application, such as Vectorworks.

With the growing number of software and hardware devices that now support and utilize MVR, we’re enabling Unreal Engine to be part of this incredible toolset ecosystem.

In order to import Vectorworks files into Unreal Engine for Live Events or VP stage previs, we added support for both GDTF and MVR to the already-existing Datasmith workflow. The necessary files are bundled in an uncompressed ZIP archive with the .mvr extension.

MVR provides DMX fixture transforms, patching information, and GDTF signature files, while Datasmith imports common 3D mesh and texture data.

This diagram outlines the workflow that would be possible after implementing the desired GDTF solution:

- Pipeline & Plugins
- Film & TV
- Virtual Production
- datasmith
- virtual production
- dmx
- mvr

## Course Lessons (3 total)

- DMX: What is MVR?
- DMX: Importing MVR to Unreal Engine
- DMX: Exporting From Vectorworks