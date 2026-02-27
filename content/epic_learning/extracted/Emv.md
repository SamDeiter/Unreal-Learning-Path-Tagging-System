# A Deep Dive on Substrate Materials

*An in-depth examination of Substrate Materials and the relation to both external material frameworks and measured material properties.*


## Theory behind F0, F90, and Specular Color

Theory behind material specular representation for the Substrate Deep Dive Course


### Overview

At the most basic level, material models define F₀ – the reflectance at normal incidence, meaning how much light reflects when it hits a surface head-on. (A quick aside: some models also define F₉₀, the reflectance at grazing angles – where light skims along the surface. But that’s tangential to this discussion…)

In Unreal Engine’s Default Lit shading model, based on Schlick’s approximation, F₉₀ is implicitly set to 1.0 for dielectrics (non-metals). That means the only input we really need to define the surface’s reflectivity is F₀ (via the Specular input in the material graph).


### F₀ in Common Dielectrics

For most everyday materials (plastics, glass, skin, wood) – often referred to as “common dielectrics,” the F₀ reflectance falls between 0% and 8%, in Unreal Engine this is represented as a value in the range [0,1].  A value of 0.5 input to the material corresponds to about 4% F₀ reflectance, which is Unreal’s default.

In practice, the Default Lit model computes F₀ from the specular input approximately as:

There’s a bit of nuance to this, but it’s close enough for the purposes of this discussion.


### Linking F₀ and Index of Refraction (IOR)

There’s a direct physical link between F₀ and the Index of Refraction (IOR) for dielectrics (non-metals).

When light moves between two media (like air and glass), some of it reflects and some refracts. The proportion that reflects at normal incidence is given by:

This assumes an external IOR of 1.0 (a vacuum or ~air). In a more general form, you can express it as:

The inverse relationship, for finding IOR from a known F₀, is:

This equation is simplified in the Unreal codebase (again, assuming an external IOR of 1.0) as:

or more generally,

These equations come directly from the Fresnel equations that describe light reflection and transmission at material boundaries.

In Unreal’s Default Lit shading model, the default Specular value of 0.5 corresponds to F₀ = 0.04, which yields an IOR = 1.5 – roughly matching many common glass or plastic materials.


### F₉₀ – Specular Color at Grazing Angles

F₉₀ represents the specular color reflected by a surface at grazing incidence – in other words, when light hits the surface at a very shallow angle relative to the viewer.  At these extreme angles, the apparent brightness and color of reflections can change noticeably due to how light interacts with the surface microstructure and the material’s optical properties.

While F₀ describes how reflective a material is when viewed head-on, F₉₀ captures the opposite condition: what the reflection looks like as the viewing angle approaches the surface plane. Together, these two values define the range of specular behavior for a material and form the endpoints of the reflectance curve used in most shading models.

In practice, F₉₀ is often treated as a constant value (usually 1.0 for ideal reflectors), but real materials can deviate from this assumption – especially those with strong directional or polarization-dependent behavior. Understanding F₉₀ helps explain why certain surfaces, such as metals, clear coats, or layered films, can exhibit brighter or more colorful reflections near their edges.


### F₀, F₉₀, and Color

Both F₀ and F₉₀ are fundamentally color-dependent properties. For dielectrics (non-metals), the reflected color is mostly neutral – meaning all wavelengths of light reflect roughly equally, so we perceive a white or gray specular highlight.

For conductors (metals), however, the reflectance depends strongly on wavelength due to how the material’s free electrons interact with incoming light – a phenomenon rooted in the photoelectric effect. This wavelength dependence means metals can produce colored specular reflections – gold, copper, and osmium being representative examples of this behavior in action.

In other words, while dielectrics can safely use a single grayscale F₀ value – a simplification leveraged by the Default Lit shading model – conductors require F₀ to be expressed as a color triplet (R, G, B) to capture wavelength-dependent reflectance. This F₀ term represents the fraction of incident light reflected at each wavelength, and therefore should always fall between 0 and 1, since it is physically impossible for any material to reflect more than 100% of incoming light.

This chromatic behavior links our discussion of F₀ and F₉₀ directly to color spaces, since these RGB triplets can only be defined within a specific set of primaries. To understand how that limitation affects our materials, let’s take a short detour into a general overview of color spaces themselves.


### A Brief Aside on Color Spaces

Color spaces define which colors can be represented in a given system. Technically, each color space defines the boundary of a volume of visible colors based on three primary wavelengths (R, G, and B), where the luminosity is the missing axis.  On a chromaticity diagram – essentially a projection of that volume onto a plane – these primaries form a triangle, and the area inside represents the gamut of that color space.  Colors that fall outside these triangles are said to be out of gamut – they can’t be faithfully represented in that space.

BT.2020

(0.556, 0.517)

(0.056, 0.587)

(0.160, 0.126)

630

532

467

Adobe RGB (1998)

(0.451, 0.523)

(0.076, 0.576)

(0.175, 0.158)

612

535

465

BT.709

(0.451, 0.523)

(0.125, 0.563)

(0.175, 0.158)

612

549

465

Display-P3

(0.496, 0.526)

(0.099, 0.578)

(0.175, 0.158)

615

544

465

The use of nanometers (nm) to describe the chromaticities of RGB primaries is a convenient shorthand, but not strictly accurate in most cases. For BT.2020, the red, green, and blue primaries lie directly on the spectral locus, so they correspond to specific wavelengths that can be expressed in nanometers.

However, for most other color spaces – including BT.709, P3, and Adobe RGB – one or more primaries (most notably blue) fall inside the spectral locus rather than on it. In these cases, there is no single wavelength that defines that point in color space, implying there is some crosstalk between primaries. The “nm” values shown are therefore approximate, serving only as a visual or comparative reference.

This relationship between spectral data and color space definition is particularly important when dealing with metallic F₀ values. The chromatic specular colors we assign must fall within the gamut of our working color space. A metal whose real-world spectral reflectance lies outside the gamut may appear slightly desaturated or shifted when represented in a more limited space like BT.709.

In other words, the RGB triplets we use in shading are not literal physical wavelengths – they’re approximations of how those wavelengths are encoded within a specific color space. Understanding this distinction helps bridge the gap between physical reflectance spectra and digital color management, linking how light actually behaves with how our renderer interprets and stores that behavior as a “color.”

- See Clark Vision: Color Spaces for further reading

### Schlick’s Approximation

In real-time graphics, we rarely evaluate the full Fresnel equations because they’re expensive to compute. Instead, we use Schlick’s approximation, which gives a close-enough result at a fraction of the cost.

- See Fresnel Equations for the full derivation
Schlick’s formula defines the Fresnel term as:

In Unreal, the dot product between the view direction and the halfway vector is

in the above equation.

- See Blinn-Phong reflection model for further details
We then blend between F₀ and F₉₀ based on that Fresnel factor:

or, equivalently,


### Polarization and Fresnel Components

In reality, what we often treat as a single Fresnel term is actually the combination of two polarization components:

- s-polarized light (perpendicular to the plane of incidence)
s-polarized light (perpendicular to the plane of incidence)

- p-polarized light (parallel to the plane of incidence)
p-polarized light (parallel to the plane of incidence)

The full Fresnel equations compute separate reflection coefficients for these two polarizations. Any polarization state can be described as a combination of these two components, which together determine the total reflected intensity.

At normal incidence (F₀), polarization can be safely ignored because the s and p components behave identically – meaning the simplified F₀ equation given earlier is exact in that case. However, at grazing angles (F₉₀), the two polarization components diverge, and this difference becomes significant.

- refractiveIndex.info

### The Brewster Angle and “Reflectance Dip”

A well-known result of this polarization behavior is the Brewster angle, where one of the polarization components (p-polarized light in dielectrics) reaches zero reflectance. This produces a dip in the reflectance curve that is not captured by the simplified Schlick approximation.

In metals (conductors), the situation becomes more complex because the refractive index and extinction coefficient (permittivity and permeability) are wavelength-dependent and complex-valued. The combination of polarization effects and chromatic material response can lead to noticeable color shifts near grazing angles. This explains why some metals exhibit hue changes or desaturation when viewed at oblique angles.

- refractiveIndex.info

### Modeling Polarization Behavior in Shading Models

The Brewster angle dip cannot be reproduced by the mathematics of the Schlick approximation alone.  Several methods have been proposed to approximate this behavior efficiently in rendering. One of the most notable is F₈₂, introduced by Naty Hoffman as part of his reparameterization of the Lazanyi-Schlick Fresnel model. In this model, F₈₂ represents the specular color at the maximal grazing angle where the Schlick approximation deviates most strongly from measured data.

Adobe later refined this approach into what they called the F₈₂ Tint Model, which treats F₈₂ as a color multiplier applied to Naty Hoffman’s modified Lazanyi-Schlick Fresnel curve. This method allows for subtle, physically plausible chromatic variation at grazing angles while remaining intuitive for artists to control.

- Original F₈₂ Model
- F₈₂ Tint model

### Structural Coloration

While we’ve discussed color so far in terms of material composition and Fresnel reflectance, some color arises instead from structure – from how light interacts with microscopic layers or repeating patterns within a surface. This family of effects is known as structural coloration.

The most familiar example is thin-film interference, where light reflects between multiple closely spaced layers of differing refractive indices. The resulting interference causes some wavelengths to amplify and others to cancel, producing angle-dependent iridescent colors. This is the same physics behind the shifting hues of soap bubbles, oil slicks, and anti-reflective coatings.

However, similar interference-driven coloration can occur in more complex microstructures as well. The brilliant colors of butterfly wings, beetle shells, and peacock feathers arise from arrays of nanoscale layers, ridges, or lattices that diffract or scatter light in specific wavelength bands. In all these cases, the geometry of the surface – not its pigment – determines the observed hue.

From a shading perspective, structural coloration effectively introduces a chromatic specular component to materials that would otherwise be neutral dielectrics. The phenomenon can make clear coats, varnishes, or biological surfaces appear to have a subtle “specular color,” even though their underlying materials are non-metallic.

In Unreal’s Legacy Default Lit shading model, replicating this behavior is non-trivial.  Artists often approximate the look by computing thin-film coloration in the material graph and feeding it into Emissive Color, or by slightly increasing Metallic and tinting the Base Color to mimic the interference hue – both of which require careful balancing to avoid breaking energy conservation or realism.

- Examples of Structural Coloration

### Why This Matters

Understanding the relationship between Specular, IOR, and F₀ helps you interpret real-world data – like you'd find listed on refractiveIndex.info – and use them to create more physically grounded materials in Unreal.

When coupled with modern shading systems like Substrate, these principles allow you to build materials that are both artistically flexible and physically plausible, bridging the gap between physical optics and practical rendering.

- Simple Dielectric Materials in Substrate
- Gemstones, Metalloids, and Semiconductors
- Conductors - From Simple to Complex
- How to find an Appropriate Reflectance for a Material
- Thin Film Interference and Secondary Roughness
- A Quick Overview of Mean Free Path
- BSDF Layering and Substrate Operators
- Metallic Representation and Interpolation
- Fuzzy Shading in Substrate
- Example Material Final Details
- Rendering
- Games
- Film & TV
- Architecture
- Visualization
- Virtual Production
- materials

## Course Lessons (11 total)

- Theory behind F0, F90, and Specular Color
- Example 1: Simple Dielectric
- Example 2: Pure Carbon
- Example 3: Pure Copper
- Interlude: How to find an Appropriate F0
- Example 4: Thin Film Interference and Secondary Roughness
- Interlude: An Aside on Mean Free Path (MFP)
- Example 5: BSDF Layering and Substrate Operators
- Interlude: Metallic Representation and Interpolation
- Interlude: Fuzz on the Substrate Slab
- Example 6: Copper – Finishing Touches and Final Details