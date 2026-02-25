# UE 5.4.x Most Common Rendering Issues

*A curated list of frequently encountered and important issues and fixes in version 5.4 that the Developer Relations team is aware of.*

## 


### 


###### 


###### 


###### 


### 


###### 


###### 


### 


###### 

- [{'type': 'paragraph', 'content': 'By default Lumen Reflections use screen traces, which may help or not. Ray traced reflections did not support screen tracing.'}]
- [{'type': 'paragraph', 'content': 'Ray traced reflections used reflection captures and the unshadowed skylight in reflections. This can be enabled in Lumen through CVars. <code class="inline-code">r.Lumen.HardwareRayTracing.LightingMode 3</code> for unshadowed skylight and <code class="inline-code">r.Lumen.HardwareRayTracing.HitLighting.ReflectionCaptures 1</code> for reflection captures.'}]
- [{'type': 'paragraph', 'content': 'Ray-traced\xa0 reflections exposed whether shadows in reflections should be area or hard. Lumen uses only hard shadows which causes less noise. In 5.5/UE5-Main this can be changed using <code class="inline-code">r.Lumen.HardwareRayTracing.HitLighting.ShadowMode</code>'}]
- [{'type': 'paragraph', 'content': 'The ray-traced reflections denoiser is sharper. Some of it can be made sharper in Lumen using CVars, for example by disabling bilateral filter using<code class="inline-code"> r.Lumen.Reflections.BilateralFilter 0</code>. The new denoiser in 5.5 will also increase sharpness.'}]
- [{'type': 'paragraph', 'content': 'Ray-traced reflections supported tracing more than one ray per-pixel, Lumen currently only supports tracing 1 ray per pixel unless you increase your screen percentage above 100%.'}]


### 


###### 


### 


###### 


###### 


```

```


### 


###### 


### 


###### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">r.shadow.virtual.cache.staticseparate 0</code> helps to save memory, since you don\'t need a separate shadow cache for static vs. dynamic invalidations'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">r.shadow.virtual.forceinvalidatedirectional 1 </code>for testing dynamic TOD performance without having to constantly move the directional light'}]


### 


###### 


######