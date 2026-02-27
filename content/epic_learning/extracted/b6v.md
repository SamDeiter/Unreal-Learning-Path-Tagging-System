# Using Niagara for Linear Content

*In this course by Dan Pearson, you'll learn about how to use and reuse Niagara simulations with Sequencer. The course discusses how to ensure that your simulation is consistent throughout a sequence, and how to reuse a simulation so that it is the same each time. It also covers how to use pre-roll warm-up so simulations are ready by the time the sequence starts, and how to handle motion blur on simulations. It concludes with considerations for working with Niagara simulations in a production environment.*


## Getting Started with Niagara for Linear Content

Set up and render a level sequence using the Movie Render Queue.


### This course is available as Niagara Documentation. Please refer to the Niagara for Linear Content documentation for the latest version of this content.

In this course, we will be using the Movie Render Queue (MRQ) plugin to generate frames. Make sure the plugin is loaded if you want to follow along.

You may also find it useful to set up ffmpeg on your system so you can automatically generate movies from your rendered frames, a link to a tutorial on this is below.


## Creating a Level Sequence

To get things started we will create a very simple Level Sequence with a Camera. We will then open up Movie Render Queue (MRQ) and generate frames.

- Right-click in the Content Browser, navigate to Cinematics and create a Level Sequence.
- Rename your Level Sequence to something appropriate.
- Double-click the Level Sequence to open it.
- Click the Camera button at the top of the Sequencer panel to create a new Cine Camera and a Camera Cuts track.
- Use the 3D view controls to position your camera to a framing that you like.

## Rendering Frames

- Press the Clapper Board button on the top of the Sequencer panel to open Movie Render Queue (MRQ).
- If you have ffmpeg configured: 
Click on the Settings for your sequence, probably called 'Unsaved Config'.
Press the +Setting button
Add a Command Line Encoder settings block.
Press the Accept button to leave the Settings dialog.
- Click on the Settings for your sequence, probably called 'Unsaved Config'.
- Press the +Setting button
- Add a Command Line Encoder settings block.
- Press the Accept button to leave the Settings dialog.
- On the Movie Render Queue panel, press the Render (Local) button.
MRQ will now run. It may compile necessary shaders as a first step before showing you a preview of the frames being generated.

This tutorial has been converted to a course. If you are missing the navigation to the rest of the content on the left, please click the link below.

- 📁Back to the first module of Using Niagara for Linear Content
- How to use FFmpeg with the Command Line Encoder in Movie Render Queue
- Cinematics & Media
- Film & TV
- niagara
- daniel pearson

## Course Lessons (7 total)

- Getting Started with Niagara for Linear Content
- Controlling Niagara Systems with Life Cycle Tracks
- Play versus Movie Render Queue
- Reusing Niagara Systems
- Pre-Roll
- Motion Blur
- Production Considerations