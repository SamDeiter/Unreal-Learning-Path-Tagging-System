# Creating a Character Navigation Heatmap Using Render Targets

*Learn how to draw your character's location into a render target to make a heatmap effect.*

### 


### 

- [{'type': 'paragraph', 'content': 'How to make a render target and write information to it'}]
- [{'type': 'paragraph', 'content': 'Using Curve assets to colorize grayscale data'}]
- [{'type': 'paragraph', 'content': 'Making an actor component that can add this heatmap logic to any desired actor'}]


### 

- [{'type': 'paragraph', 'content': 'An alternative approach would be preferred if you want to efficiently track hundreds or thousands of characters.'}]
- [{'type': 'paragraph', 'content': 'This technique is based on mesh UV coordinates and the quality breaks down if you want to record more complex 3D spatial data such as jumping, flying, or multi-leveled environments'}]
- [{'type': 'paragraph', 'content': 'Similar to the previous point, extremely large tracking areas could be limited by the resolution of the render target.'}]


### 


### 


### 


### 

- [{'type': 'paragraph', 'content': '<b>Begin Draw Canvas to Render Target</b> (Prepare the RT)'}]
- [{'type': 'paragraph', 'content': '<b>Line Trace by Channel</b> (Get the position to draw)'}]
- [{'type': 'paragraph', 'content': '<b>Draw Material</b> (Apply our brush material to the RT)'}]
- [{'type': 'paragraph', 'content': '<b>End Draw Canvas to Render Target</b> (Complete the drawing and update the RT)'}]


```

```


### 

- [{'type': 'paragraph', 'content': 'Create a <b>CurveAtlasRowParameter</b> node, and name the parameter whatever you want.'}]
- [{'type': 'paragraph', 'content': 'Connect the <b>Green channel</b> of the render target sample to the <b>CurveTime</b> input and then feed the results to the <b>Emissive Color</b> attribute. The CurveTime only accepts a Float value (single channel). Any channel works but Green is historically the least compressed.'}]
- [{'type': 'paragraph', 'content': 'Select the curve atlas node and set the <b>Atlas</b> parameter to the curve atlas you made.'}]
- [{'type': 'paragraph', 'content': 'Select the desired color <b>Curve</b> from that atlas.'}]


### 


###