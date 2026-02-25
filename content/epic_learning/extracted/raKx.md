# Import Customization with Interchange

*Learn how to customize and extend  data import in the editor using Interchange Pipeline.
A demo project is provided to illustrate pipelines type as well as different operations.*

### 

- [{'type': 'paragraph', 'content': 'how to make and use custom pipelines: C++, blueprint or python'}]
- [{'type': 'paragraph', 'content': 'how to modify factory settings or assets during import'}]
- [{'type': 'paragraph', 'content': 'how to create a new translator and factories to support new file format and new Unreal Object'}]
- [{'type': 'paragraph', 'content': 'how the same file exported to different file formats will produce consistent results in the Engine'}]


### 


### 

- [{'type': 'paragraph', 'content': 'Unzip the archive in an appropriate folder'}]
- [{'type': 'paragraph', 'content': 'Generate the solution. Right click on the project file, and select "Generate Visual Studio Project Files"'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Switch it to use the version of UE you want'}], [{'type': 'paragraph', 'content': 'Generate the solution'}]]}]
- [{'type': 'paragraph', 'content': 'Open the generated solution in Visual'}]
- [{'type': 'paragraph', 'content': 'Build development editor configuration'}]
- [{'type': 'paragraph', 'content': 'Execute InterchangeDemo'}]


### 

- [{'type': 'paragraph', 'content': '<b>4 pipelines</b>: 2 C++, one blueprint and one python'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Custom Static Mesh Pipeline, a C++ Pipeline to create geometry from placeholders in the 3D model'}], [{'type': 'paragraph', 'content': 'Custom Demo Object Pipeline, a C++ Pipeline to set properties on a new Unreal object'}], [{'type': 'paragraph', 'content': 'Custom Texture Pipeline, a Blueprint Pipeline to change compression and texture group on a texture'}], [{'type': 'paragraph', 'content': 'Custom Folder Management, a Python Pipeline to create assets in appropriate subfolders'}]]}]
- [{'type': 'paragraph', 'content': '<b>Source code</b>\xa0for the <b>C++ Pipelines</b>\xa0and the "Demo Object" <b>class, factory, translator</b>\xa0(.foo extension) and other utility classes'}]
- [{'type': 'paragraph', 'content': 'One <b>FBX sample file</b>\xa0to test the static mesh pipeline.'}]
- [{'type': 'paragraph', 'content': 'One <b>USD file</b> to demonstrate support for newer file formats through Interchange framework'}]
- [{'type': 'paragraph', 'content': 'One <b>glTF sample file </b>to test the static mesh pipeline with different format.'}]
- [{'type': 'paragraph', 'content': 'One <b>foo sample file</b>\xa0to test the "Demo Object" pipeline'}]
- [{'type': 'paragraph', 'content': 'All of the FBX, glTF and USD files use a PBR Material and the appropriate textures could be found in the same folder under the <code class="inline-code"><i>Textures/</i></code>.'}]


#### 


#### 


##### 

- [{'type': 'paragraph', 'content': 'At the\xa0<b>execute pipeline</b>\xa0step, the pipeline will convert\xa0<b>translated scene nodes\xa0</b>of the edges placeholders into 3D transform attributes on the\xa0<b>static mesh factory node</b>.\xa0\xa0'}, {'type': 'image', 'image_id': 73792, 'caption': "Differences in the attributes when the 'import custom static mesh wedges' is enabled/disabled.", 'alt_text': '', 'image': {'id': 73792, 'file_name': 'CustomStaticMeshPipelineImportPreview.png', 'file_size': 224211, 'content_type': 'image/png', 'created_at': '2025-07-28T22:22:52.794+00:00', 'height': 1368, 'width': 2111, 'storage_key': '4a730185-a966-4bb1-950d-b7bb676f5ebf', 'context': 'learning'}, 'storage_key': '4a730185-a966-4bb1-950d-b7bb676f5ebf', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'At the <b>post factory </b>step, the pipeline will extract attributes previously set on the <b>static mesh factory node</b> and generate a mesh description for each wedge and append it to the existing mesh description.'}]


##### 


#### 


##### 


##### 


#### 


##### 


##### 


#### 


##### 


##### 


##### 


##### 


###