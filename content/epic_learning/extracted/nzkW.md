# Mutable: Table Nodes Tutorial

*How to use Data Tables for multiple choices in Mutable*

### 


### 

- [{'type': 'paragraph', 'content': 'The\xa0<code class="inline-code">SK_BaseBody</code>\xa0Skeletal Mesh, with its default Materials and Textures.\xa0'}, {'type': 'image', 'image_id': 64753, 'caption': '', 'alt_text': '', 'image': {'id': 64753, 'file_name': 'SK_BaseBody.png', 'file_size': 35867, 'content_type': 'image/png', 'created_at': '2025-02-13T09:55:35.505+00:00', 'height': 267, 'width': 170, 'storage_key': '46a4a063-7816-4bd3-8eb6-187ad5e2abb5', 'context': 'learning'}, 'storage_key': '46a4a063-7816-4bd3-8eb6-187ad5e2abb5', 'context': 'learning', 'width': None}, {'type': 'image', 'image_id': 64767, 'caption': '', 'alt_text': '', 'image': {'id': 64767, 'file_name': 'MI_MaleBodyYoung.png', 'file_size': 45905, 'content_type': 'image/png', 'created_at': '2025-02-13T11:01:02.462+00:00', 'height': 272, 'width': 175, 'storage_key': '97762f0c-f074-427f-9aa7-acb4b5ffbf42', 'context': 'learning'}, 'storage_key': '97762f0c-f074-427f-9aa7-acb4b5ffbf42', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': '\xa0 The\xa0<code class="inline-code">SK_Shoes</code>\xa0Skeletal Mesh, with its default Materials and Textures.\xa0'}, {'type': 'image', 'image_id': 64760, 'caption': '', 'alt_text': '', 'image': {'id': 64760, 'file_name': 'SK_Shoes.png', 'file_size': 28282, 'content_type': 'image/png', 'created_at': '2025-02-13T10:09:32.319+00:00', 'height': 270, 'width': 168, 'storage_key': '8706937d-5656-4dd4-9772-d0b76a8ae0d4', 'context': 'learning'}, 'storage_key': '8706937d-5656-4dd4-9772-d0b76a8ae0d4', 'context': 'learning', 'width': None}, {'type': 'image', 'image_id': 64761, 'caption': '', 'alt_text': '', 'image': {'id': 64761, 'file_name': 'MI_Shoes.png', 'file_size': 31046, 'content_type': 'image/png', 'created_at': '2025-02-13T10:09:45.403+00:00', 'height': 267, 'width': 167, 'storage_key': '5866274c-d20e-4310-b642-2249412c2d2c', 'context': 'learning'}, 'storage_key': '5866274c-d20e-4310-b642-2249412c2d2c', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': '\xa0 The\xa0<code class="inline-code">SK_Boots</code>\xa0Skeletal Mesh, with its default Materials and Textures.\xa0 \xa0'}, {'type': 'image', 'image_id': 64762, 'caption': '', 'alt_text': '', 'image': {'id': 64762, 'file_name': 'SK_Boots.png', 'file_size': 30084, 'content_type': 'image/png', 'created_at': '2025-02-13T10:09:59.192+00:00', 'height': 267, 'width': 168, 'storage_key': 'c290d3bd-1386-4b4a-ac76-bda16f5e5c84', 'context': 'learning'}, 'storage_key': 'c290d3bd-1386-4b4a-ac76-bda16f5e5c84', 'context': 'learning', 'width': None}, {'type': 'image', 'image_id': 64763, 'caption': '', 'alt_text': '', 'image': {'id': 64763, 'file_name': 'MI_Boot.png', 'file_size': 42061, 'content_type': 'image/png', 'created_at': '2025-02-13T10:10:14.390+00:00', 'height': 267, 'width': 168, 'storage_key': '71c2fb2c-9501-40ec-9781-3337f43fd058', 'context': 'learning'}, 'storage_key': '71c2fb2c-9501-40ec-9781-3337f43fd058', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'The <code class="inline-code">DT_Table_Node</code> Data Table. This asset will store all the asset of the different variations. Each column representing a pin in our Table Node and each row representing a variation for our objects.'}, {'type': 'image', 'image_id': 64768, 'caption': '', 'alt_text': '', 'image': {'id': 64768, 'file_name': 'DT_Table_Node.png', 'file_size': 4235, 'content_type': 'image/png', 'created_at': '2025-02-13T11:01:35.947+00:00', 'height': 271, 'width': 171, 'storage_key': 'bc160c0d-65c7-4367-a1e5-85a9ee19cfa2', 'context': 'learning'}, 'storage_key': 'bc160c0d-65c7-4367-a1e5-85a9ee19cfa2', 'context': 'learning', 'width': None}]

- [{'type': 'paragraph', 'content': 'The <code class="inline-code">F_Table_Node</code> Structure. This asset will determine the structure and default values of our Data Table. Each variable of this Struct will generate a new column in our Data Table. Also, it allows to select the Default Asset which defines the common structure of the Table assets.'}, {'type': 'image', 'image_id': 64769, 'caption': '', 'alt_text': '', 'image': {'id': 64769, 'file_name': 'F_Table_Node.png', 'file_size': 3778, 'content_type': 'image/png', 'created_at': '2025-02-13T11:01:50.939+00:00', 'height': 271, 'width': 167, 'storage_key': '2cc72c33-6bcc-4204-8165-8eced8973cd8', 'context': 'learning'}, 'storage_key': '2cc72c33-6bcc-4204-8165-8eced8973cd8', 'context': 'learning', 'width': None}]


### 


### 

- [{'type': 'paragraph', 'content': 'Create a Skeletal Mesh node and, in the <i>Node Properties</i> panel, select set the\xa0<code class="inline-code">SK_BaseBody</code>\xa0as the Skeletal Mesh.'}]
- [{'type': 'paragraph', 'content': 'Drag the <code class="inline-code">LOD 0 - MI_MaleBodyYoung - Mesh</code>\xa0pin create a new Mesh Section node. The Material will be set automatically to <code class="inline-code">MI_MaleBodyYoung</code>\xa0Material Instance.'}]
- [{'type': 'paragraph', 'content': 'From the <code class="inline-code">Mesh Section</code>\xa0Pin of the Mesh Section node create a new Mesh Component node and we will name it <code class="inline-code">Body</code>. We won\'t use the head Mesh Component in this example.'}]
- [{'type': 'paragraph', 'content': 'Finally, connect the Mesh Component output pin to the Components pin in the Base Object node. Rename the Base Object node to <code class="inline-code">Character</code>'}, {'type': 'paragraph', 'content': 'If you have any doubt with this steps see the\xa0<a href="https://dev.epicgames.com/community/learning/tutorials/Y41o/unreal-engine-mutable-simple-customizable-object">Simple Customizable Object</a>\xa0tutorial for more details.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': 'Click Compile and check the <i>Preview Instance:</i>'}]


#### 

- [{'type': 'paragraph', 'content': 'Structure:\xa0In this tab we are going to define the structure of our data table by pressing the <code class="inline-code">+ Add Variable</code>\xa0button.'}]
- [{'type': 'paragraph', 'content': 'Default Values:\xa0In this tab we are going to define the default values for each variable of the struct.'}]


#### 

- [{'type': 'paragraph', 'content': 'Data Table:\xa0This tab shows the information of each row and columns of the table. Right now there are two columns, one for the name of the row <code class="inline-code">Row Name</code> (automatically generated) and another one for the variables that we just created in the Structure <code class="inline-code">SK_Mesh</code>\xa0and <code class="inline-code">Material</code>.'}]
- [{'type': 'paragraph', 'content': 'Data Table Details:\xa0Tab with some information of the table. We are going to ignore it.'}]
- [{'type': 'paragraph', 'content': 'Row Editor:\xa0Tab to select the assets that we want to use for each row.'}]


#### 

- [{'type': 'paragraph', 'content': 'Create a Child Object node and name it <code class="inline-code">Shoes</code>'}]
- [{'type': 'paragraph', 'content': 'Create a Mesh Component node and connect it to Child Object\'s <code class="inline-code">Components</code>\xa0pin. In the Mesh Component\'s Reference Skeletal Mesh drop down menu select <code class="inline-code">SK_Shoes</code> as the default skeletal mesh.'}]
- [{'type': 'paragraph', 'content': 'Create a Mesh Section node and select <code class="inline-code">MI_Shoes</code> in the Node Properties Material drop down menu.'}, {'type': 'paragraph', 'content': 'You should have something like this at this point:'}, {'type': 'image', 'image_id': 64942, 'caption': '', 'alt_text': '', 'image': {'id': 64942, 'file_name': 'image.png', 'file_size': 69232, 'content_type': 'image/png', 'created_at': '2025-02-17T12:10:59.773+00:00', 'height': 318, 'width': 1228, 'storage_key': 'c64aac26-93fb-47c4-94f9-fab34f4bc2cd', 'context': 'learning'}, 'storage_key': 'c64aac26-93fb-47c4-94f9-fab34f4bc2cd', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Last but not least, create a new Table node from the context menu Object &gt; Table. Name it <code class="inline-code">Shoe Type</code>. This will be shown at the Parameter Name field in the Table node properties tab.'}, {'type': 'paragraph', 'content': 'From the Table node Node Properties tab, clic on the Table drop down menu and select the recently created Data Table called <code class="inline-code">DT_Table_Node</code>. '}, {'type': 'image', 'image_id': 64947, 'caption': '', 'alt_text': '', 'image': {'id': 64947, 'file_name': 'CO_Table_Node_details_0.png', 'file_size': 54479, 'content_type': 'image/png', 'created_at': '2025-02-17T12:17:14.587+00:00', 'height': 537, 'width': 522, 'storage_key': '26e2efab-dea8-47b8-b598-90d6ec8fa734', 'context': 'learning'}, 'storage_key': '26e2efab-dea8-47b8-b598-90d6ec8fa734', 'context': 'learning', 'width': None}, {'type': 'paragraph', 'content': "You'll see how the node refreshes automatically after selecting the Data Table and the mesh pins appear."}, {'type': 'image', 'image_id': 64949, 'caption': '', 'alt_text': '', 'image': {'id': 64949, 'file_name': 'CO_Table_Node_details_3.png', 'file_size': 25540, 'content_type': 'image/png', 'created_at': '2025-02-17T12:19:15.130+00:00', 'height': 268, 'width': 265, 'storage_key': 'b358e341-5d2a-444b-8ca6-c8608ce92900', 'context': 'learning'}, 'storage_key': 'b358e341-5d2a-444b-8ca6-c8608ce92900', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'We have to select the default option when this parameter is activated. To do so, write down the one of your choice in the <i>Default Row Name</i> field. Use <code class="inline-code">Boots</code> in this example. Note that has to be written exactly as it is in the Data Table row name.'}, {'type': 'image', 'image_id': 64951, 'caption': '', 'alt_text': '', 'image': {'id': 64951, 'file_name': 'CO_Table_Node_details_4.png', 'file_size': 16217, 'content_type': 'image/png', 'created_at': '2025-02-17T12:20:48.211+00:00', 'height': 256, 'width': 361, 'storage_key': 'cc884f5e-8d8d-4b85-8a28-a2e0b6e79830', 'context': 'learning'}, 'storage_key': 'cc884f5e-8d8d-4b85-8a28-a2e0b6e79830', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Also scroll down to the <i>Pins</i> section and only mark as active the <code class="inline-code">SK_Mesh LOD_0 Mat_0</code> and the <code class="inline-code">Material</code>\xa0ones like so:'}, {'type': 'image', 'image_id': 64960, 'caption': '', 'alt_text': '', 'image': {'id': 64960, 'file_name': 'CO_Table_Node_details_5.png', 'file_size': 22310, 'content_type': 'image/png', 'created_at': '2025-02-17T12:59:23.608+00:00', 'height': 387, 'width': 365, 'storage_key': 'e23636ee-7bb1-4cd6-94a7-403a680c7656', 'context': 'learning'}, 'storage_key': 'e23636ee-7bb1-4cd6-94a7-403a680c7656', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Now, connect both <code class="inline-code">SK_Mesh LOD_0 Mat_0</code> and <code class="inline-code">SK_Material</code> pins to the Mesh Section node <code class="inline-code">Mesh</code> and <code class="inline-code">Table Material</code> pins.'}, {'type': 'image', 'image_id': 64961, 'caption': '', 'alt_text': '', 'image': {'id': 64961, 'file_name': 'CO_Table_Node_details_2.png', 'file_size': 65140, 'content_type': 'image/png', 'created_at': '2025-02-17T13:00:31.845+00:00', 'height': 288, 'width': 1061, 'storage_key': '4cb970db-29d6-4365-82b2-754b9d856b60', 'context': 'learning'}, 'storage_key': '4cb970db-29d6-4365-82b2-754b9d856b60', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Finally connect Shoes\' <code class="inline-code">Object</code> pin of the Child Object node to the <code class="inline-code">Children</code> pin of the Base Object node.'}, {'type': 'image', 'image_id': 64962, 'caption': '', 'alt_text': '', 'image': {'id': 64962, 'file_name': 'CO_Table_Node_details_7.png', 'file_size': 133941, 'content_type': 'image/png', 'created_at': '2025-02-17T13:01:48.074+00:00', 'height': 557, 'width': 1167, 'storage_key': '28450596-2760-442f-b7eb-d0ea1a3d7650', 'context': 'learning'}, 'storage_key': '28450596-2760-442f-b7eb-d0ea1a3d7650', 'context': 'learning', 'width': None}]


#### 


### 


#### 


### 


#### 


### 


#### 


###