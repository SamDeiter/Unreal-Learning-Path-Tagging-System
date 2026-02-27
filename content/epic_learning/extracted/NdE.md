# Laser Scanning by Quixel

*For photogrammetry, certain subjects and materials are more suitable for capture than others. Laser scanning compliments photogrammetry by capturing the shape detail of subjects and surfaces that would otherwise be difficult to capture with photogrammetry alone. Shiny surfaces are difficult to capture with photogrammetry because reflections create misleading data. Laser scanners can capture the shape of these shiny or reflective surfaces but do not capture the texture detail. Because of this, every laser scanned subject is also scanned using the photogrammetry method.*


## Introduction to Laser Scanning

When scanning using photogrammetry, sometimes the surface of the subject does not yield quality results. Examples of this type of subject include reflective subjects (a shiny plastic chair or a porcelain bowl), transparent subjects (semi transparent plastics or tinted glass), and featureless subjects (a flat wall with no surface details or a similarly smooth surface). When photogrammetry is unable to capture the subject accurately, it is necessary to scan the subject using the laser scanning method.
When subjects can be scanned and recreated using photogrammetry alone, then the laser scanning method is not used.

🅿️  Back to "Learning Path"


## Purpose

The purpose of this document is walk through the laser scanning processes. The goal is to provide a guide to the process from which the User may adapt when laser scanning their own projects.


## Scope

The scope of this document includes a general overview and sequence of events necessary to complete a laser scan from start to finish. For more information about photogrammetry, refer to the relevant photogrammetry document:

- An Introduction to Photogrammetry
An Introduction to Photogrammetry

- Core Principles of Scanning for Photogrammetry
Core Principles of Scanning for Photogrammetry

- Processing RAW Images
Processing RAW Images

- Aligning Images in RealityCapture
Aligning Images in RealityCapture

- Processing Digital Assets
Processing Digital Assets

- Introduction to Vegetation Scanning
Introduction to Vegetation Scanning


## Audience

This document is intended for anyone already practicing photogrammetry that encounters subjects which do not provide quality results using photogrammetry alone.


## Course Notation

Throughout this document, information is marked by a note system. The notes found are marked by a distinguishable icon and are introduced by text indicating their purpose.

📋  Note: Notes add additional information about a topic or include links to additional resources.

☢️  Caution: Caution notes indicate a potential for damage to equipment or to process result. These notes do not cover all cases or situations, but are intended to highlight the most common mistakes or potentials for error.


## Course Contents

- Course Overview
- Getting Started
- Laser Scan the Subject
- Aligning the Laser Model with the Photo Model
- Clean Up and Unwrap the Laser Model
- Baking the Texture
- Format the Texture File
- Testing the Digital Asset
- Common Issues with Laser Scanners

## Equipment and Software

☢️  Caution: Due to the nature of software development, features and functionality of third-party software referenced in this document may change from what is detailed here. Always consult the software manufacturer’s documentation to resolve issues and stay up‑to‑date on changes to third‑party products.

The focus of this course is on the Laser Scanning process using the following equipment and software.

📋  Note: Comparable equipment or software can be used instead of those listed below but may require additional information or processes not provided in this document.


### Equipment

- Creaform Handyscan 3D Black Elite -  The handheld laser scanner (with calibration plate, cables, and VXelements software).
Creaform Handyscan 3D Black Elite -  The handheld laser scanner (with calibration plate, cables, and VXelements software).

- Graphics Capable Laptop Computer - Any windows-based laptop will work if the graphics card and processor are sufficiently capable to run the software listed below. At Quixel, we are currently using the HP Zbook G6 Mobile Workstation with the NVIDIA Quadro RTX3000 graphics card and an i9 processor.
Graphics Capable Laptop Computer - Any windows-based laptop will work if the graphics card and processor are sufficiently capable to run the software listed below. At Quixel, we are currently using the HP Zbook G6 Mobile Workstation with the NVIDIA Quadro RTX3000 graphics card and an i9 processor.

- Target Points/Marker Stickers - Both low and medium sticky and magnetic target points are recommended.
Target Points/Marker Stickers - Both low and medium sticky and magnetic target points are recommended.

- Turntable - A turn‑able table to place and rotate the subject on. A turntable is not necessary for all subjects but is useful for subjects small enough to sit on it.
Turntable - A turn‑able table to place and rotate the subject on. A turntable is not necessary for all subjects but is useful for subjects small enough to sit on it.


### Software

- Adobe Photoshop
Adobe Photoshop

- CloudCompare
CloudCompare

- Marmoset
Marmoset

- RealityCapture
RealityCapture

- VXelements
VXelements

- xNormal
xNormal

📋  Note: There are various manufacturers of laser scanners and publishers of interfacing software. The following information is based on technologies and software by Creaform. Additional Information or resources are available at the Creaform website.


## What is Laser Scanning?

Laser scanning is the process of capturing a target shape using projected light (laser beams) instead of a camera sensor. The laser scanner emits beams of light in a target direction and then measures how long the beams take to reflect and return to the scanner. The scanner software calculates the shape of the target surface from thousands of reflections happening every second.

Because the laser scanner is not impacted by reflections, image exposure, or blurred pixel data the way that photogrammetry is, the scan data resulting from laser scanning is highly accuracy. Compare the difference in mesh accuracy between the following two images:

🅿️  Back to "Learning Path"

- Asset Creation
- Rendering
- Games
- Film & TV
- Architecture
- Visualization
- photogrammetry

## Course Lessons (10 total)

- Course Overview
- Getting Started
- Laser Scan the Subject
- Flash Scan with Photogrammetry
- Aligning the Laser and Photo Models
- Clean Up and Unwrap the Laser Model
- Baking the Texture
- Format the Texture File
- Testing the Digital Asset
- Common Issues with Laser Scanners