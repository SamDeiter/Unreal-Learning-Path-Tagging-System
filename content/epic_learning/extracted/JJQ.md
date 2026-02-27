# Content Curation by Quixel

*This course looks at what is involved in organizing assets into collections. From deciding target subjects to compiling digital assets into collections, this process is essential for asset management.*


## Content Curation

After reviewing the subject and location data from scouting, and with the project goals in mind, the target assets are identified and organized in a process called curation. This section discusses the key elements of content curation.

🅿️  Back to "Learning Path"


### Content Curation

It is easy to see the environment for what it is, but recall the project goals. With the goals in mind, move through the location identifying subjects necessary to recreate the environment in context of the project goals.


### Access

To get the best scanning data possible, it is necessary to capture images from all sides of a subject. Therefore ensure that a scan artist holding a camera rig can comfortably walk around each subject. The scan area should be as clear of obstructions and obstacles as possible and allow complete and safe access.

Safety is paramount! Absolutely make sure that the subjects are safe to capture. Be mindful that the scan artist's attention is divided between the camera, the subject, the scan pattern, the sun and shade, and even tiny obstacles should be considered as potential trip hazards. Spot potholes, changes in elevation, roots, stones, anything which beyond level terrain.


### Attractiveness

A subject should be interesting enough to warrant scanning. Scanning, reconstructing, and processing an asset requires a considerable amount of time and it would be unfortunate to realize after the whole process that the subject isn't very useful or interesting to use in game. This is where scouting and carefully considering the environment comes into play and will likely save a lot of time down the line.


### Uniqueness

While we always want to find the most interesting assets in general, it is important to think of the usability of an asset. For instance, a surface with a paint splash would be interesting but not if tiled in a game engine as the standout details would repeat. If possible, scan the paint mark itself as a decal. The same logic is applied to assets containing graffiti. It is preferable to scan a clean surface and add the graffiti later in engine.


### Shape and Complexity

Certain convoluted shapes do not lend themselves well to scanning. In general, convex shapes are easier to reconstruct than concave ones. Keep this in mind when selecting ideal subjects.

Overhangs are a challenge to scan as well. This is because of the added difficulty of capturing every side properly. In addition to the difficulty to scan, overhangs can also be problematic during reconstruction.

Remember that with scanning, each corner must be captured from side A, side B, and directly on. A subject with a lot of angles require a lot of images to capture it with sufficient coverage (capturing the edges and all  sides). This is just something to consider when selecting between two visually similar ideal subjects - which subject is the most efficient and would produce the best results during recreation.

Extremely thin subjects (or subjects with very thin elements) are difficult, if not impossible, to reconstruct due to the small amount of pixels present in the scan images.


### Material

Some types of surfaces are bad candidates for photogrammetry. Due to the nature of photogrammetry, it is very difficult to reconstruct a shiny or transparent object. Reflections are inherently bad as they shift when scanning from different angles. These changing reflections trick reconstruction software. Without managing the reflections with deliberate process adjustments, the reconstruction is likely to fail. It is strongly advised to avoid shiny metals, clean reflective plastics, lacquer or wood with reflective veneers, porcelain, transparency and wet surfaces.

📋  Note: It is possible to scan shiny or reflective subjects, but doing so requires significant overhead to every stage of the photogrammetry process (additional preparation prior to scanning, through scanning, alignment, and asset processing).

📋  Note: Shiny or featureless assets are better scanned with a laser scanner when possible. Refer to the Laser Scanning by Quixel course for additional details.

Additionally, surfaces with large areas that lack details are difficult to process, as the reconstruction software is unable to distinguish between the pixels. Using markers can help remedy this issue, however, additional processing time and effort will then be required to edit the texture to remove the markers.


### Size

In order to get a good quality scan, good data are needed, which means a good enough coverage of the asset. The size of the asset dictates the equipment to use and the camera settings (Refer to Scanning by Quixel: Capture Method Based on Subject Size for more details). Scanning a cliff will require the use of a drone for best results, and a DSLR camera with a good lens is necessary when scanning very small object. The flash scanner is probably most suitable be for objects ranging from roughly 50cm to ~5-10m max. The size of the object also affects the amount of pictures necessary to capture and therefore, increases the reconstruction time.


### Asset Type

It is important to perceive which category of asset a subject falls into, as this may determine the way it is scanned. A concrete floor strewn with scattered bricks is an interesting surface but could be more useful if separated into individual digital assets. A concrete surface and a 3D brick offer much more flexibility in their use. The brick, independent from the concrete floor, can be rotated on any axis for greater variety in a digital environment.

📋  Note: While some of the natural beauty of a subject may be due to the environment, the subject still needs to be scanned isolated from that environment. To recreate an environment, each of the subjects within it are treated as separate subjects of it. That is, to recreate a rock by a bush with grass spurts jutting from the ground, the rock, the grass, the bush, and the ground would all be scanned as separate subjects. Once created as digital assets (most likely, as part of a digital asset collection), a digital artist will use the assets to recreate the environment.


### Collections

When scouting an area, think of the target subjects as being in a collection of digital assets. Designers of digital environments rarely need a single digital asset but prefer a collection of assets that appear uniform and consistent. Take the following collection as an example. The assets are uniform and easy to insert into any digital space using any digital lighting effects.

The most common ones being, Environments or prop collections, environments can usually be defined as either natural biomes or manmade structures that in most cases are modular.


### Biomes

Biomes are natural made environments. Deserts, beaches, mountains, rivers, etc. are all biomes types. When world building, biomes often refer to specific ecosystems, such as a desert tundra, with unique rock formations, hardy drought resistant vegetation, and other distinguishing features. Each biome type is analyzed for the biome defining subjects which are present there. Once identified, each of the subjects are curated into asset classes.


### Asset Classes

Review the project goals prior to scouting a location. Create (or modify) a list of the asset types necessary to complete the goals. The list should include all subjects necessary to complete a collection or to recreate an environment. To assist with this, it is useful to pre-define basic asset types. For example, when recreating a full biome, the asset types may include:

Here, sizes (XL, L, M S, Scatter / Spline) are assigned per biome relative to the size of subjects within. So the largest assets would be classified as "XL" while the smallest would be "S". All other subjects would be "L" or "M" based on their sizes relative to the "XL" and "S" subjects.

Detail textures follow the same format, but with "Fine," "Coarse," and "Rocky". Again, this is based on the subjects within a particular biome and may include more or less size labels as necessary.

Here we have Rocky, Course, and Fine terrain texture and scatter. The goal of labeling the subjects this way is to improve subject/asset visibility. This aspect of content curation allows the whole team to assess the target subjects and captured assets against the project goals.

In the below image, The labels are put to use in engine to create realistic environments using the size labeled assets.

Not all asset types are in every biome. A cornfield would not have Cliff, Rock, Ledge, or Cluster types. Modify the list of asset types to meet the project goals. Consistency is key here as the asset type is used from scouting all the way through to post production. Even the assets in Megascans are defined by their asset type.


### Modular Environments

While scouting an environment with complex subjects, consider the subject modularity. That is, consider if the subject could be scanned as a collection of smaller digital assets which could be recombined during digital recreation. Often, a subject or environment can be digitally reconstructed using just a few key components. Review the image below. One support column of an overpass often looks exactly like the next. Decide if it is necessary to scan all supports or just the unique ones. Stand out features, such as markings, signs, cracks, and damage, can be added as decals in engine during reconstruction.


### Prop Collections

Props (short for property or properties) are scanned to include in larger, manmade, non-biome environment collections. Assets such as coat hangers, which can be placed inside of a closet, are props. Props are usually decorative enhancements to environments such as a mine, warehouse, junkyard, or harbor. Often, props are curated into smaller related collections like medieval banquet, trash, Weapons etc..

Props are typically manmade and therefore require extra attention regarding copywrite. Consider once again the goals for the prop collection and how the props will be used. If a prop is branded or contains unique brand identifying features check laws and regulations regarding copywrite on each subject before using them for any commercial purposes. While scouting, capture reference photos of every visible angle of the subject so it can be evaluated later (or by legal counsel) for infringing logos, text, or markings before adding it to the scanning shot-list.

Plan the prop collection by going through the attributes above (attractiveness, uniqueness, size etc.) for each prop to ensure a good mix suitable for the intended environment. Too few of a particular type may lead to an incomplete environment when recreated. Too many of the same prop type is wasted effort when scanning the environment.

Keep the project goals in mind. Where the props originate from is not important, so long as the props in the collection harmonize together and appear consistent once placed together in an environment. When scanning for a kitchen collection, for example, chairs, food, tableware, etc. can all be found in various different locations. This flexibility makes assembling a prop collection easier from the office, but could lead to more effort going to different places when scouting and scanning.

🅿️  Back to "Learning Path"

- Asset Creation
- World Creation
- Rendering
- Pipeline & Plugins
- Cinematics & Media
- Games
- Film & TV
- Architecture
- Visualization
- Virtual Production
- world creation
- animation
- modeling
- foliage
- environment art
- post process
- virtual production
- level design
- photogrammetry

## Course Lessons (1 total)

- Content Curation