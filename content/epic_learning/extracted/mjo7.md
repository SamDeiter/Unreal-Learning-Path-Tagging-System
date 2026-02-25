# Temporal Quality Guide

*A short guide on temporal rendering artifacts and how to go about improving them*

## 


## 


## 


## 


### 


## 


## 

- [{'type': 'paragraph', 'content': 'Show → Visualize → Temporal Upscaler (I/O buffers for any temporal upscaler).'}]
- [{'type': 'paragraph', 'content': 'Show → Visualize → Temporal Super Resolution or r.TSR.Visualize (overview grid; e.g., 7 = Flickering Temporal Analysis, 2 = History Rejection, 6 = Spatial AA).These views let you see the inputs/masks that drive ghosting, flicker, and history rejection.'}]


### 

- [{'type': 'paragraph', 'content': 'Raise internal render resolution: Increase r.ScreenPercentage until flicker is acceptable (common 4K targets land ~60–80%+). Higher input resolution reduces flickering and gives TSR more data to work with.'}]
- [{'type': 'paragraph', 'content': 'Leverage TSR scalability: Higher Anti‑Aliasing scalability can improve stability; it also affects TSR history behavior (see “Pros & cons” below). Adjust via Settings → Engine Scalability Settings or sg.AntiAliasingQuality.'}]
- [{'type': 'paragraph', 'content': 'Tune flicker controls for your target FPS with the following CVars:'}]


```

```

- [{'type': 'paragraph', 'content': 'Lower frame rates need more aggressive stabilization; FrameRateCap and Period are the intended knobs'}]

- [{'type': 'paragraph', 'content': 'Texture mips vs. sharpness: Automatic View Mip Bias can oversharpen and then flicker at low screen percentages. For high‑frequency textures, opt out or bias your mip levels manually per texture to trade sharpness for stability.'}]


### 

- [{'type': 'paragraph', 'content': 'Enable motion data for translucency: in the material, turn on Output Depth and Velocity; optionally raise Opacity Mask Clip Value so only opaque chunks write velocity (reduces edge smearing).'}]
- [{'type': 'paragraph', 'content': 'Prefer “After DOF” translucency: TSR is designed to reproject post‑DOF translucency; UE even auto‑routes some behind‑focus translucency (r.Translucency.AutoBeforeDOF) to reduce sorting/ghosting pitfalls.'}]


### 

- [{'type': 'paragraph', 'content': 'Mark materials as “Has Pixel Animation.” UE encodes a mask into the velocity buffer so TSR knows those pixels are intentionally changing and shouldn’t be over‑stabilized. Tune flicker settings afterward if needed.'}]


### 

- [{'type': 'paragraph', 'content': 'In Project Settings → Rendering, enable Output velocities due to vertex deformation so the engine double‑evaluates current/previous deform for a correct velocity field (on by default in recent UE5). If you switch Velocity Pass to Write after base pass, expect extra draw calls.'}]
- [{'type': 'paragraph', 'content': 'Verify vectors: use VisualizeMotionBlur and VisualizeReprojection (under Show → Visualize) to spot assets with wrong or missing velocity.'}]


### 

- [{'type': 'paragraph', 'content': 'Raise input resolution (r.ScreenPercentage) or increase AA scalability a notch. For movement, bias toward sharpness by lowering TSR’s velocity weight, clamping a bit:'}]


```

```


### 


```

```


## 


```

```


```

```

- [{'type': 'paragraph', 'content': 'Opaque with pixel animation: enable Has Pixel Animation on the material (UE encodes a mask in the velocity buffer that the flicker analysis honors)'}]
- [{'type': 'paragraph', 'content': 'WPO/vertex‑animated: enable Output velocities due to vertex deformation; confirm vectors with Visualize Motion Blur/Reprojection'}]
- [{'type': 'paragraph', 'content': 'Translucency: enable Output Depth and Velocity; adjust Opacity Mask Clip Value for cleaner vectors; keep pass = After DOF unless you have a specific reason to change it'}]


## 

- [{'type': 'paragraph', 'content': 'Temporal Super Resolution (pipeline stage, visualization modes, scalability knobs). (<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/temporal-super-resolution-in-unreal-engine">Epic Games Developer\xa0Community</a>)'}]
- [{'type': 'paragraph', 'content': 'Anti‑Aliasing & Upscaling in UE (methods, where to set them, scalability group). (<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/anti-aliasing-and-upscaling-in-unreal-engine">Epic Games Developer Community</a>)'}]
- [{'type': 'paragraph', 'content': 'Temporal Upscalers (where temporal upscalers plug in; Automatic View Mip Bias; pre‑exposure & translucency notes; visualization). (<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/temporal-upscalers-in-unreal-engine">Epic Games Developer Community</a>)'}]
- [{'type': 'paragraph', 'content': 'TSR FAQ (history ranges; motion‑sharpness trade‑offs; translucency guidance). (<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/temporal-super-resolution-frequently-asked-questions-for-unreal-engine">Epic Games Developer Community</a>)'}]
- [{'type': 'paragraph', 'content': 'TSR history at Epic/Cinematic (why 200% history can hurt 4K perf). (<a href="https://gpuopen.com/learn/unreal-engine-performance-guide/">gpuopen.com</a>)'}]
- [{'type': 'paragraph', 'content': 'Lumen Performance Guide (<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-performance-guide-for-unreal-engine">Epic Games Documentation</a>)'}]