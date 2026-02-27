# Using Movie Render Graph

*Learn about the new Movie Render Graph feature in Unreal Engine.*


## MRG: Introduction

Discover the new Movie Render Graph in 5.4.

Movie Render Graph (MRG) was created to provide users with a node-based system to manage render settings while creating high-quality image sequences and movie renders with Movie Render Queue (MRQ). These graphs can be as simple or complex as necessary to address the needs of both small and large teams.

These graphs can be set up to render a single shot or designed to scale out across complex multi-shot workflows. These graphs can be modified and saved as reusable assets, introducing greater flexibility to production pipelines.

The Legacy preset system of MRQ can be used interchangeably with the new MRG.


## Prerequisites

- Familiarity with these two Movie Render Queue documentation pages is recommended before continuing:Movie Render QueueRender Settings
Familiarity with these two Movie Render Queue documentation pages is recommended before continuing:

- Movie Render Queue
Movie Render Queue

- Render Settings
Render Settings

- A project with a Level Sequence to render. The Main_Seq Level Sequence in the Meerkat Demo can be used as a sample.
A project with a Level Sequence to render. The Main_Seq Level Sequence in the Meerkat Demo can be used as a sample.


## Plugins and Settings


### Movie Render Queue Plugin

Enable the Movie Render Queue plugin (Edit > Plugins > Movie Render Queue).

Restart the editor.


### Project Alpha Channel Support

In Project Settings, Enable alpha channel support in post-processing is generally recommended to be set to Linear color space only, but you should pick what is best for your project. However, it cannot be Disabled for Render Layers  to have an alpha channel in the output images when the visibility and holdout modifier parameters are used.


## Opening the Movie Render Graph

The Movie Render Graph is accessible through the Movie Render Queue, which can be opened in two different ways.

- Through the Unreal Engine main toolbar, navigate to Window > Cinematics > Movie Render Queue.
Through the Unreal Engine main toolbar, navigate to Window > Cinematics > Movie Render Queue.

- Through Sequencer, use the vertical ellipses next to the Render Movie icon to expand the Render Movie Options. Select Movie Render Queue, then click the Render Movie button.
Through Sequencer, use the vertical ellipses next to the Render Movie icon to expand the Render Movie Options. Select Movie Render Queue, then click the Render Movie button.

This will open the Movie Render Queue window.

Click the arrow in the Settings column and select Replace with Graph (Experimental).

Click the arrow again and select New Graph.

Name and save the graph in the Save Asset As window that appears.

It will now be shown in the Movie Render Queue Settings column and listed as a graph asset.

Click on the graph in the Settings column to open it.

- Rendering
- Pipeline & Plugins
- Cinematics & Media
- Film & TV
- Virtual Production
- Games
- Architecture
- Visualization
- movie render queue
- rendering
- virtual production
- mrq
- movie render graph
- mrg

## Course Lessons (5 total)

- MRG: Introduction
- MRG: Settings and Nodes
- MRG: Settings Overrides and Variables
- MRG: Advanced Settings
- MRG: Transitioning to the Movie Render Graph