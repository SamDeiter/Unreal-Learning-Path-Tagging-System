# Creating Custom Constellations for the Celestial Vault Plugin

*In this article, we'll go through basic usage of the new Celestial Vault Plugin, with a focus on creating custom Stars Catalogs*

## 


## 


### 

- [{'type': 'paragraph', 'content': 'Create a new project from a Template with UE 5.6. I often use the Simulation Template, but since the GeoReferencing plugin is optional here, I’ll just use a First Person Template'}]
- [{'type': 'paragraph', 'content': 'Enable the "Celestial Vault" Plugin and restart the Editor'}]
- [{'type': 'paragraph', 'content': 'In the level just created with the Template, an environment is already set up using several actors. Since the Celestial Vault Day Sequence actor will replace them, delete all these actors. The world will turn black.'}]
- [{'type': 'paragraph', 'content': 'From the Quick Add button, add a new Celestial Vault Day Sequence Actor to the level, and wait for the Eye adaptation to converge.'}]
- [{'type': 'paragraph', 'content': 'The lighting updates to a nice morning sun, since the Time of Day is 6 am by default.'}]

- [{'type': 'paragraph', 'content': 'Adjust the latitude and longitude for your place, and the Time Zone'}]
- [{'type': 'paragraph', 'content': 'If you check the “Use current Date”, it will display the sky of the day. It might be a new moon, so very dark at night. In this case, you can use the Moon/Manual control option to manually adjust the moon phase.'}]
- [{'type': 'paragraph', 'content': 'If you feel like the moonlight is really dark if you’re not at full moon, you can increase the Moon Light intensity a little bit (usual values are 0.1-0.32 Lux, 0.32 being for a SuperMoon)'}]


### 

- [{'type': 'paragraph', 'content': 'Locate the materials in the "<b>EngineData/Plugins/CelestialVault/Materials</b>" folder'}]
- [{'type': 'paragraph', 'content': 'Select the 5 potentially relevant Material instances (MI_*), and copy them to your project\xa0(Or create new Material Instances from the same Base Materials)'}]
- [{'type': 'paragraph', 'content': 'Replace the respective materials in the various components of the Celestial Vault Day sequence actor. (Deep Sky, Stars, Planets, MoonDisc)'}]


## 


### 

- [{'type': 'paragraph', 'content': 'The first step is to draw white stars of different sizes. (You can also directly paint colors, but I’ll use a gradient later here.) Use a dark background to facilitate the detection process'}]
- [{'type': 'paragraph', 'content': 'The size of the points will be considered at extraction time to compute Magnitudes. So, draw large points for bright stars.'}]
- [{'type': 'paragraph', 'content': 'It’s fine to sweep the brush a little bit to vary the sizes. At the end of the process, we’ll extract the best-fit circle, so it doesn’t need to be a regular circular shape.'}]
- [{'type': 'paragraph', 'content': 'Feel free to add a little bit of randomness if you want.'}]

- [{'type': 'paragraph', 'content': 'Then create a new layer with the color. Here is a gradient.'}]
- [{'type': 'paragraph', 'content': "Once done, I flatten the stars' layers, select the black pixels, and remove this selection from the gradient layer!"}]
- [{'type': 'paragraph', 'content': 'And that’s it, we have colored dots on a back background.'}]


### 


### 

- [{'type': 'paragraph', 'content': 'Make sure you have a proper Python environment installed on your computer. See <a href="https://www.python.org/downloads/">https://www.python.org/downloads/</a> (and add Python to your PATH)'}]
- [{'type': 'paragraph', 'content': 'Download the <a href="https://epicgames.box.com/s/jowga8zqefkb66mryahtmnqnv5ftsai4">FictionalStarsBuilder.py</a> file and copy it to a local directory'}]
- [{'type': 'paragraph', 'content': 'From a regular command line prompt (cmd.exe), run the following two commands to install the prerequisites. (you only need to do it once)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'pip install opencv-python'}], [{'type': 'paragraph', 'content': 'pip install pillow'}]]}]
- [{'type': 'paragraph', 'content': 'Execute the program by running this command, adapted to your file location'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'python "F:\\Python\\FictionalStarsBuilder\\FictionalStarsBuilder.py"'}]]}]


### 

- [{'type': 'paragraph', 'content': 'The initial picture is converted to grayscale for better identification'}]
- [{'type': 'paragraph', 'content': 'This grayscale picture is Thresholded from the bottom, to remove the darker pixels that might be caused by encoding noise'}]
- [{'type': 'paragraph', 'content': 'The dots are extracted using Minimum and Maximum size filters'}]
- [{'type': 'paragraph', 'content': 'If two dots are close to each other, they could be merged by the system. A minimum distance between blobs allows for a better separation'}]
- [{'type': 'paragraph', 'content': 'Once blobs are identified, we export a CSV file containing the values'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'X, Y location of the star (Normalized between [-1..1]'}], [{'type': 'paragraph', 'content': 'Magnitude: Linear interpolation of Min/Max magnitude between bigger/smaller dots'}], [{'type': 'paragraph', 'content': 'RGB color, extracted from the input image'}]]}]

- [{'type': 'paragraph', 'content': 'Display Mode'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Original - Display the input image'}], [{'type': 'paragraph', 'content': 'Grayscale - Display the grayscaled input image'}], [{'type': 'paragraph', 'content': 'Threshold - Display the resulting image following the Min Threshold operation'}]]}]
- [{'type': 'paragraph', 'content': 'Draw Star Blobs - Display the red circles corresponding to the detected stars'}]
- [{'type': 'paragraph', 'content': 'Image Threshold Min - Colors darker than this value will be discarded'}]
- [{'type': 'paragraph', 'content': 'Blob Min/Max area - Size filter for the blobs we want to detect (in square pixels)'}]
- [{'type': 'paragraph', 'content': 'Minimum Distance between Blobs - Separation value. Lower it if you see merged blobs.'}]
- [{'type': 'paragraph', 'content': 'Brightest/Faintest Star Magnitudes - The magnitude values scale for the blob sizes.'}]


### 

- [{'type': 'paragraph', 'content': 'Download the <a href="https://epicgames.box.com/s/4gzho9ig5v3s7shv2hcht4hvgezoqk4f">FictionalStarsBuilder.xlsx</a> file and open it.'}]
- [{'type': 'paragraph', 'content': 'Open the file you just created with the Python app using the Data/From Text/CSV import feature.'}]
- [{'type': 'paragraph', 'content': 'The content will show up in a new Sheet.'}]
- [{'type': 'paragraph', 'content': 'Copy and paste the values (not the header row) onto the peach range of the FictionalStarBuilder Sheet. You should see a representation of the input stars in a blue graph.'}]
- [{'type': 'paragraph', 'content': 'Define the location where you want to place the constellation (in Stellar Coordinates, so Right ascension is in hours, one hour = 15°)'}]
- [{'type': 'paragraph', 'content': 'Choose its size and rotation angle, and look at the exported Stars data to see a preview on the celestial vault.'}]
- [{'type': 'paragraph', 'content': 'Once ready, go to the output Sheet, and export it as a CSV.'}]


### 

- [{'type': 'paragraph', 'content': 'Drag and drop <a href="https://epicgames.box.com/s/86t88yluox8dzam6h29xbxgfle7u5b0u">the CSV file you just exported</a> from the spreadsheet into the content browser.'}]
- [{'type': 'paragraph', 'content': 'Make sure that you select the “StarInputData” type as DataTable Row Type, that you check all the boxes, and set “ID” in the Import Key Field.'}]
- [{'type': 'paragraph', 'content': 'You might have a warning message about missing IDs. Don’t worry, it’s because Excel still export “,,,,” for empty lines. Cleaning the CSV would remove it, but it doesn’t matter.'}]
- [{'type': 'paragraph', 'content': 'Drag and Drop the new Catalog to the Fictional Catalog property, and you’re done! A new constellation is born.'}]


###