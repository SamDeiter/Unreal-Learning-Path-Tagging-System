# Multi-Process Rendering

*Multi-Process Rendering*


## Multi-Process Rendering: Introduction

Learn about Multi-Process Rendering and how it differs from Multi-GPU.


## What is Multi-Process Rendering?

Introduced in Unreal Engine 5.2, Multi-Process Rendering is a method of utilizing the power of multiple GPUs for nDisplay rendering. This approach allows specific viewports to be rendered simultaneously on each GPU. For example, the outer frustum could be rendered on the primary GPU while the inner frustum is rendered on a secondary GPU.

In the vast majority of cases (scene dependent), Multi-Process rendering is more performant than Multi-GPU rendering, which was introduced in 4.27. Multi-Process and Multi-GPU share the same physical hardware configuration, so there is no disadvantage to switching to a Multi-Process workflow. Multi-Process is also the recommended way to render with multiple NVIDIA ADA Lovelace GPUs, as they do not support NVLink which is recommended for Multi-GPU (mGPU) configurations.

As the name implies, Multi-Process rendering launches two instances, or processes, of Unreal Engine on each render node. The first is a regular nDisplay node. This is also known as the onscreen node because it renders out to the LED wall and is visible in Windows when rendering. The second node, which operates as a separate Windows process, is a headless instance that is not directly visible and is referred to as the offscreen node.

In the frustum example above, the offscreen node will render the inner frustum on the secondary GPU, sharing it back to the onscreen node as a texture. The onscreen node, which is rendering on the primary GPU, composites the inner frustum over the outer frustum and displays it out to the LED wall.

Multi-Process will only share the final rendered texture between GPUs via CPU/Motherboard. Sharing the rendered texture is more efficient than Multi-GPU, which requires huge bandwidth to share all GPU memory via the NVLink and SLI.

The two methods can be compared in the following table:


## Technical Prerequisites

- At least two GPUs
- SLI must be disabled (see Nvidia documentation for configuring SLI)
- If using Nvidia Mosaic, ensure that it is not set to Premium Mosaic, as this enables SLI
- Disable Intel Hyper-Threading / AMD Simultaneous Multi-Threading. We recommend doing this to ensure the best performance. Please note that disabling either of these may impact performance for other software you are using. You may experience longer shader compile times.
- The currently supported NVIDIA drivers and control panel settings, including synchronization. This information can be found on our nDisplay Synchronisation with NVIDIA GPUs page.

## Knowledge Prerequisites

- Familiar with the concepts in the ICVFX quickstart guide, including how to create a new config.
- NVIDIA Documentation
- nDisplay Synchronization with NVIDIA GPUs
- In-Camera VFX Quick Start
- Film & TV
- Architecture
- Visualization
- Virtual Production

## Course Lessons (3 total)

- Multi-Process Rendering: Introduction
- Multi-Process Rendering: Getting Started
- Multi-Process Rendering: Converting an mGPU Config