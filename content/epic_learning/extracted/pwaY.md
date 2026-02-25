# Nearest Neighbor Model 5.4

*Nearest Neighbor Model*

# 


```

```


## 


# 

- [{'type': 'paragraph', 'content': '<b>Nearest Neighbor Model</b> is selected'}]
- [{'type': 'paragraph', 'content': '<b>Training </b>is selected'}]


# 


## 

- [{'type': 'paragraph', 'content': '<b>Skeletal Mesh</b>: This is the skeletal asset to be deformed.'}]
- [{'type': 'paragraph', 'content': '<b>Training Input Anims</b>: The list of animations used as training data'}]
- [{'type': 'paragraph', 'content': '<b>Anim Sequence</b>: These are the groundtruth poses. They can be a sequence of randomly created poses.'}]
- [{'type': 'paragraph', 'content': '<b>Geometry Cache</b>: This includes the groundtruth meshes that are simulated on each of the groundtruth poses. You would import this from an alembic file.'}]
- [{'type': 'paragraph', 'content': '<b>Network Inputs</b>: This defines the input to the network. This is generally bone rotations.\xa0'}]


## 

- [{'type': 'paragraph', 'content': 'You generally want to run offline simulation to generate your groundtruth data in geometry cache. For clothing, you can use Houdini Vellum or Chaos Cloth.\xa0'}]
- [{'type': 'paragraph', 'content': 'In your simulation, you want to simulate the mesh for several frames until the mesh stops moving.'}]
- [{'type': 'paragraph', 'content': 'It is usually better to turn off gravity during the simulation (currently the network only takes joint rotations as input which does not account for gravity)'}]
- [{'type': 'paragraph', 'content': 'Use randomly created poses like ones created by <code class="inline-code">MLDeformer Maya plugin</code>.\xa0Do NOT only use poses from a regular animation, as we\'ve seen that the network can become overfitted.'}]
- [{'type': 'paragraph', 'content': "Make sure all three rotational dimensions of each joint are sampled. The range of angles may be small but should not be 0. If some dimensions aren't sampled, the network can become overfitted."}]
- [{'type': 'paragraph', 'content': 'Use a good number of poses. We recommend 5,000, but the more the better.'}]
- [{'type': 'paragraph', 'content': '\xa0Check vertex deltas are reasonably small. You can check the vertex deltas by looking at the green lines on Training Base mesh. Big vertex deltas can lead to poorly trained results.'}]


## 


## 


# 

- [{'type': 'paragraph', 'content': '<b>InputDim </b>and <b>OutputDim</b>: These represent the number of inputs and outputs in the network. These values are automatically updated by the engine.\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'InputDim = num_joints * 3'}], [{'type': 'paragraph', 'content': 'OutputDim = sum(num_basis)'}]]}]
- [{'type': 'paragraph', 'content': "<b>Hidden Layer Dims</b>: This array sets the number of 'hidden layers' and the number of 'neurons' in each layer."}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '\xa0The numbers should gradually move from the InputDim to OutputDim. For instance, if the input is 63 and the output is 256, the hidden layer dimensions could be [64, 128].'}], [{'type': 'paragraph', 'content': 'Typically, 2-4 hidden layers are sufficient.'}], [{'type': 'paragraph', 'content': 'Hidden layers can NOT be empty before training. If left empty, the editor will automatically populate its values.'}], [{'type': 'paragraph', 'content': 'Generally we observe that the hidden layer dims have very little impact on final results as long as the rules above are followed. If not (for example if hidden layer dim is smaller than InputDim and OutputDim), it can lead to poor results.'}]]}]
- [{'type': 'paragraph', 'content': '<b>Num Epochs</b>: the number of times to loop through entire training set at training. The default number 10000 is safe but usually too high for most assets. 2500 is recommended for a dataset with 5k poses.'}]


# 

- [{'type': 'paragraph', 'content': '<b>Num Basis</b>: This is the number of basis utilized to model this section. The more basis there are, the more accurate the model will be, but it will also require more memory as the model has to store more basis.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '\xa0 This parameter is editable when Use PCA is checked and otherwise uneditable and equals to <code class="inline-code">Num Basis Per Section</code>'}]]}]
- [{'type': 'paragraph', 'content': '<b>Weight Map Creation Method</b> and <b>Vertex Indices</b>: They are used to define a section using a vertex map. There are three ways of defining a section:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>From Text</b>: Define a section using vertex indices by writing a text string.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'There are predefined strings using mesh info in the skeletal mesh component.'}, {'type': 'image', 'image_id': 53056, 'caption': 'Weight map From Text', 'alt_text': '', 'image': {'id': 53056, 'file_name': 'vertmap_fromtext.png', 'file_size': 12477, 'content_type': 'image/png', 'created_at': '2024-04-02T17:47:23.922+00:00', 'height': 127, 'width': 641, 'storage_key': '57d672ab-9bff-4a99-b98f-8cdc72878781', 'context': 'learning'}, 'storage_key': '57d672ab-9bff-4a99-b98f-8cdc72878781', 'context': 'learning', 'width': None}], [{'type': 'paragraph', 'content': 'You can also define a section using a custom string like the first picture in this section. An example can be “0-5, 9, 12, 37-50”. This can be useful if you defined a group in vertex Houdini and want to copy the vertex indices to Unreal (remember to add commas).'}]]}], [{'type': 'paragraph', 'content': '<b>Selected Bones</b>: Define a section by selecting bones. All vertices influenced by the selected bones are included (NOTE: helper joints need to be selected as well). The vertex deltas are multiplied by skin weights to create a smooth blending to non-selected areas.'}, {'type': 'image', 'image_id': 53057, 'caption': 'Weight Map From Bones', 'alt_text': '', 'image': {'id': 53057, 'file_name': 'vertmap_frombones.png', 'file_size': 15475, 'content_type': 'image/png', 'created_at': '2024-04-02T17:50:08.265+00:00', 'height': 114, 'width': 663, 'storage_key': 'd326e6f2-b0ab-4044-9462-eaf79bbbc8a1', 'context': 'learning'}, 'storage_key': 'd326e6f2-b0ab-4044-9462-eaf79bbbc8a1', 'context': 'learning', 'width': None}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Select Bones</b>: open the widget to select bones.\xa0'}], [{'type': 'paragraph', 'content': '<b>Create Attribute</b>: create a vertex attribute using skin weights of selected bones. This is useful for the ‘Vertex Attribute’ method.'}]]}], [{'type': 'paragraph', 'content': '<b>Vertex Attribute</b>: Define a section using a vertex attribute. You can manually paint vertex attribute in the skeletal mesh painting tool. All vertices with non-zero weights are included in the section. The vertex deltas are multiplied by the weights to create a smooth blending to non-selected areas.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Attribute Name</b>: attribute name used to define the section'}], [{'type': 'paragraph', 'content': 'To create a vertex attribute to work with, you can use the <b>Create Attribute</b> button in <b>Selected Bones</b> submenu, or you can use any existing float vertex attribute on the skeletal mesh.'}], [{'type': 'paragraph', 'content': 'To paint vertex attribute, you need <b>Skeletal Mesh Editing Tools</b> plugin. Go to Edit Tools → Edit Skin Weights → Paint Maps, and then select attribute to modify.'}, {'type': 'image', 'image_id': 53059, 'caption': '', 'alt_text': '', 'image': {'id': 53059, 'file_name': 'SkeletalMeshEdit.png', 'file_size': 4281052, 'content_type': 'image/png', 'created_at': '2024-04-02T17:54:13.353+00:00', 'height': 2006, 'width': 3790, 'storage_key': '17e7ca60-1bce-481d-819c-265ef72712b4', 'context': 'learning'}, 'storage_key': '17e7ca60-1bce-481d-819c-265ef72712b4', 'context': 'learning', 'width': None}]]}], [{'type': 'paragraph', 'content': '<b>External Txt</b>: Sometimes it is more desirable to paint mask in external software like Houdini. You can paint a mask and export a .txt file, with each line a float number representing a weight for a vertex.'}, {'type': 'image', 'image_id': 53060, 'caption': 'Weight Map Txt', 'alt_text': '', 'image': {'id': 53060, 'file_name': 'vertmap_txt.png', 'file_size': 8924, 'content_type': 'image/png', 'created_at': '2024-04-02T17:54:59.029+00:00', 'height': 99, 'width': 511, 'storage_key': 'd9ef6089-0b9e-48c0-a5d9-4c05dc1b950a', 'context': 'learning'}, 'storage_key': 'd9ef6089-0b9e-48c0-a5d9-4c05dc1b950a', 'context': 'learning', 'width': None}, {'type': 'paragraph', 'content': 'Weight Map Txt '}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '⚠️ You need to make sure the vertex order is the same as Unreal sometimes reorders the meshes in a skeletal mesh data.'}], [{'type': 'paragraph', 'content': 'An example of a python snippet to export vertex weights in Houdini looks like'}, {'type': 'code_snippet', 'description': '', 'snippet_type': 'python', 'title': '', 'code_preview': 'node = hou.pwd()\ngeo = node.geometry()\n\nimport numpy as np\nimport os\nmask_values = [point.attribValue(&#39;mask&#39;) for point in geo.points()]\noutput_path = os.path.expandvars(&#39;$HIP/mask/upper.txt&#39;)\nprint(&#39;write to&#39;, output_path)\nnp.savetxt(output_path, np.array(mask_values), fmt=&#39;%f&#39;)', 'lines_of_code': 9, 'id': 18879, 'url_signature': 'eyJzbmlwcGV0X2lkIjoxODg3OSwidXJsX2V4cGlyZXNfYXQiOiIyMDI2LTAyLTI2VDIwOjQxOjM3KzAwOjAwIn0=--5d62c919291c2fcca2095f93a6329bb1642940b33c6b7342934c253c511fe67d'}], [{'type': 'paragraph', 'content': 'To make sure the vertex order is the same, sometimes you may need to reorder vertices in Houdini. You can assign new indices to vertices based on vertex order in Unreal and use a sort node to sort the vertices. The following python snippet shows an example to create a new attribute called ‘assigned_index’ for sorting.'}, {'type': 'code_snippet', 'description': '', 'snippet_type': 'python', 'title': '', 'code_preview': 'node = hou.pwd()\ngeo = node.geometry()\n\nattr_name = &#39;assigned_index&#39;\nif not geo.findPointAttrib(attr_name):\n    geo.addAttrib(hou.attribType.Point, attr_name, 0, create_local_variable=False)\n\n# Use your new indices. \n# You can find these numbers in Section, &#39;From Text&#39; weight creation method. \n# In this example, we simply swap the first mesh and the second mesh.\n', 'lines_of_code': 13, 'id': 18880, 'url_signature': 'eyJzbmlwcGV0X2lkIjoxODg4MCwidXJsX2V4cGlyZXNfYXQiOiIyMDI2LTAyLTI2VDIwOjQxOjM3KzAwOjAwIn0=--08d600d39e7d7dfb5a394d6d0757b6f8027b4499574592b1c30a07b85dc771fe'}]]}]]}]
- [{'type': 'paragraph', 'content': '<b>Neighbor Poses</b>: Poses in the nearest neighbor dataset. This dataset refers to the dataset used to improve the intricate geometric details of your model. It is enabled for editing after the network is trained. If left None, no nearest neighbor delta will be applied.'}]
- [{'type': 'paragraph', 'content': '<b>Neighbor Meshes</b>: Meshes in the nearest neighbor dataset. It is enabled for editing after the network is trained. If left None, no nearest neighbor delta will be applied.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Neighbor Poses </b>and <b>Neighbor Meshes</b> can be automatically generated by Key Pose Extraction Tool or by hand-picking in external tools or a combination of both.'}]]}]


## 

- [{'type': 'paragraph', 'content': 'Check <b>Draw Verts</b>'}]
- [{'type': 'paragraph', 'content': 'Choose a section to visualize'}]


## 

- [{'type': 'paragraph', 'content': 'You can define sections for overlapping regions that you want to apply nearest neighbor search separately. For example, you can have a section for torso and two sections for both arms.'}]
- [{'type': 'paragraph', 'content': 'If you have non-overlapping regions, it is better to have separate MLDeformer assets rather than the same asset with separate sections. In practice, you want the upper and lower costume to be in separate MLDeformer assets. This way, the motion on upper body will not affect details on lower body and vice versa. The above example is only for demonstration purpose.'}]


## 


# 

- [{'type': 'paragraph', 'content': '<b>Network State</b>: when the network was last trained'}]
- [{'type': 'paragraph', 'content': '<b>Inference State</b>: current state of the asset. You can use this field to determine whether re-training or re-updating is needed after a property is modified.\xa0\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The exception is when skeletal mesh or training data is reimported. The inference state won’t update but you need to re-train the asset. Similarly if nearest neighbor data is reimported, you need to re-update.'}]]}]
- [{'type': 'paragraph', 'content': '<b>Morph Target State</b>: when the morph target was last updated.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Network Architecture</b>: the architecture of the last trained network. It has the format of\xa0<code class="inline-code">InputDim [HiddenLayerDims] OutputDim</code>. This is the architecture of currently loaded network, which could be different from HiddenLayerDims attribute in training settings which are the architecture of network going to be trained.\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Update</b>: update the morph targets of the model.\xa0 \xa0\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Clear References</b>: clear any references/dependencies to other assets (Animation Sequence or Geometry Cache). This could be useful for asset validation if you do not want to check in those large assets to your\xa0 repo.\xa0'}]


# 

- [{'type': 'paragraph', 'content': '<b>Use PCA</b>: whether to use PCA to compute basis. PCA is a procedural method that precompute the basis from a dataset. If unchecked, basis will be trained with the network.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '\xa0When using PCA, the model is more likely to be smeared out but less likely to have high frequency noises. '}, {'type': 'paragraph', 'content': 'When not using PCA, the model is likely to have better details but it is more prone to artifacts.'}]]}]
- [{'type': 'paragraph', 'content': '<b>Use Dual Quaternion Deltas</b>: This option uses dual quaternion skinning to compute and invert vertex deltas. Sometimes we see better results and sometimes we see worse.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Only vertex deltas are computed using dual quaternions. The base skin is not.\xa0Turning this option on does NOT turn linear blend skinning to dual quaternion skinning. It only affects how deltas are computed.'}], [{'type': 'paragraph', 'content': 'We need to use <b>DG_DQDeform_RecomputeNormals</b> in Engine content for deformer graph. This is the default option.'}]]}]
- [{'type': 'paragraph', 'content': '<b>Decay factor</b>: This determines the rate at which the details from the previous frame fade away in the current frame. The formula to calculate the current frame\'s details is as follows :\xa0<code class="inline-code">current_frame_wrinkle = decay_factor * last_frame_wrinkle + (1 - decay_factor) * predicted_wrinkle</code>.\xa0\xa0Changing this option does not require re-training or re-updating of the model.\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Use RBF</b>: use radial basis function to compute nearest neighbor deltas. By default (off), the model finds a single nearest neighbor and apply its details to the final result. When turned on, the model will find several nearest neighbors and blend them based on the radial basis function before applying to the final result. This could lead to smoother result. Changing this option does not require re-training or re-updating of the model. '}]
- [{'type': 'paragraph', 'content': '<b>RBFSigma</b>: the sigma parameter used in radial basis function. Larger value will leads to blending of more neighbors and smoother result. Changing this option does not require re-training or re-updating of the model.'}]


# 


# 


# 


## 


# 

- [{'type': 'paragraph', 'content': '<b>Nearest Neighbor Model Asset</b>: the asset used to compute clusters'}]
- [{'type': 'paragraph', 'content': '<b>Section Index</b>: the section index used to compute clusters'}]
- [{'type': 'paragraph', 'content': '<b>Num Clusters</b>: the number of clusters to be extracted'}]
- [{'type': 'paragraph', 'content': '<b>Extract Geometry Cache</b>: whether to extract geometry cache at the same time. If unchecked, the tool will only create an animation sequence. If checked, the tool will also create a geometry cache.'}]
- [{'type': 'paragraph', 'content': '<b>Inputs</b>: the data to extract poses from'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Poses</b>: the poses to be clustered'}], [{'type': 'paragraph', 'content': '<b>(Optional) Cache</b>: the geometry cache for each pose. This is only required when <b>Extract Geometry Cache</b> is checked.\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The number of frames in cache should equal to the number of keys in Poses'}]]}], [{'type': 'paragraph', 'content': '<b>Must Include Frames</b>: frames that must be included in the final output'}]]}]
- [{'type': 'paragraph', 'content': '<b>Extracted Poses</b>: the file to write the output poses to. You either overwrite an existing file or create a new file by using the New Poses button'}]
- [{'type': 'paragraph', 'content': '<b>Extracted Cache</b>: the file to write the output geometry cache to. You either overwrite an existing file or create a new file by using the <b>New Geometry Cache</b> button'}]
- [{'type': 'paragraph', 'content': '<b>New Pose</b>: create a new empty animation sequence'}]
- [{'type': 'paragraph', 'content': '<b>New Geometry Cache</b>: create a new empty geometry cache'}]
- [{'type': 'paragraph', 'content': '<b>Extract</b>: to run the extract key pose tool. This will output results in Extracted Poses and Extracted Cache. It will also output result in Output Log.\xa0'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The results are formed into pairs. The first number is the animation index. The second number is the frame. You can use this information to assemble dataset in external software.'}]]}]


# 

- [{'type': 'paragraph', 'content': '<b>Nearest Neighbor Model Asset</b>: the asset used to compute stats'}]
- [{'type': 'paragraph', 'content': '<b>Test Anim</b>: the animation to be tested'}]
- [{'type': 'paragraph', 'content': '<b>Section Index</b>: the section index used to compute stats'}]
- [{'type': 'paragraph', 'content': '<b>Get Stats</b>: compute stats and output results in the Output Log.'}]

- [{'type': 'paragraph', 'content': '<b>Index</b>: the 0-based index in the nearest neighbor dataset'}]
- [{'type': 'paragraph', 'content': '<b>similar poses</b>: poses that are most similar to this poses in the dataset'}]
- [{'type': 'paragraph', 'content': '<b>occurrence</b>: the number of occurrence as nearest neighbor in the test animation'}]
- [{'type': 'paragraph', 'content': '<b>frames</b>: the frames that this pose acted as the nearest neighbor in the test animation'}]