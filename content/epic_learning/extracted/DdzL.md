# Efficient materials for large worlds

*Improve the precision and performance of your materials with this one simple trick!*

### 


### 


### 

- [{'type': 'paragraph', 'content': 'Absolute World Position'}]
- [{'type': 'paragraph', 'content': 'Actor Position'}]
- [{'type': 'paragraph', 'content': 'Object Position<br>'}]
- [{'type': 'paragraph', 'content': 'Particle Position<br>'}]
- [{'type': 'paragraph', 'content': 'Camera Position<br>'}]
- [{'type': 'paragraph', 'content': 'Transform Position (* to Absolute World Space)'}]

- [{'type': 'paragraph', 'content': 'Noise'}]
- [{'type': 'paragraph', 'content': 'Vector Noise<br>'}]
- [{'type': 'paragraph', 'content': 'Runtime Virtual Texture Sample<br>'}]
- [{'type': 'paragraph', 'content': 'SamplePhysicsScalarField<br>'}]
- [{'type': 'paragraph', 'content': 'SamplePhysicsVectorField<br>'}]
- [{'type': 'paragraph', 'content': 'SamplePhysicsIntegerField<br>'}]
- [{'type': 'paragraph', 'content': 'DistanceToNearestSurface<br>'}]
- [{'type': 'paragraph', 'content': 'DistanceFieldGradient<br>'}]
- [{'type': 'paragraph', 'content': 'DistanceFieldApproxAO<br>'}]
- [{'type': 'paragraph', 'content': 'SkyAtmosphereAerialPerspective<br>'}]
- [{'type': 'paragraph', 'content': 'SkyAtmosphereLightIlluminance<br>'}]
- [{'type': 'paragraph', 'content': 'Atmosphere Fog Color.'}]


```

```


### 


### 

- [{'type': 'paragraph', 'content': 'If you’re converting <b>to</b> translated space, do it as <b>early </b>as possible. This can be with the TransformPosition node, but you can also subtract from another worldspace position.<br>'}]
- [{'type': 'paragraph', 'content': "If you're converting <b>from </b>translated space, do it as <b>late</b> as possible."}, {'type': 'enhanced_list', 'style': 'ordered', 'items': []}]
- [{'type': 'paragraph', 'content': 'Multiplying an LWC with a large value, or dividing it with a small fraction increases the absolute size of the error and should be avoided.<br>'}]
- [{'type': 'paragraph', 'content': 'Division or multiplication with a power of two does not introduce additional rounding error, and is therefore preferable over non-pow2 factors.<br>'}]
- [{'type': 'paragraph', 'content': 'When dealing with LWC, prefer simpler operations (add/subtract/multiply)<br>'}]
- [{'type': 'paragraph', 'content': 'Consider using vertex interpolators to re-use expensive calculations across pixels<br>'}]
- [{'type': 'paragraph', 'content': "Generally the compiler will optimize as much as it can, but it's good practice to mask vectors early and re-use calculations as much as possible.<br>"}]
- [{'type': 'paragraph', 'content': 'Test your material for precision issues (see below)<br>'}]


### 


### 


###