# Your First 60 Minutes With Motion Matching

*A getting started guide for Motion Matching.  We cover Character blueprint setup, Motion Matching assets, and how procedural fixup can be used to compensate for low animation coverage.  We also discuss debugging a Motion Matching setup along with a number of other tips and tricks.*

### 


### 

- [{'type': 'paragraph', 'content': 'Pose Search'}]
- [{'type': 'paragraph', 'content': 'Chooser'}]
- [{'type': 'paragraph', 'content': 'Animation Insights'}]
- [{'type': 'paragraph', 'content': 'Animation Warping'}]


### 


### 


#### 

- [{'type': 'paragraph', 'content': 'Select the Skeletal Mesh Component and change the Mesh to SKM_Manny'}, {'type': 'image', 'image_id': 54691, 'caption': '', 'alt_text': '', 'image': {'id': 54691, 'file_name': 'image.png', 'file_size': 15870, 'content_type': 'image/png', 'created_at': '2024-04-27T01:03:54.416+00:00', 'height': 148, 'width': 744, 'storage_key': 'd8cf4ffb-e81b-4062-8202-3aa84f6fffb0', 'context': 'learning'}, 'storage_key': 'd8cf4ffb-e81b-4062-8202-3aa84f6fffb0', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Select BP_ThirdPersonCharacter in the component list and set Use Controller Rotation Yaw'}, {'type': 'image', 'image_id': 54693, 'caption': '', 'alt_text': '', 'image': {'id': 54693, 'file_name': 'image.png', 'file_size': 6283, 'content_type': 'image/png', 'created_at': '2024-04-27T01:06:16.238+00:00', 'height': 91, 'width': 743, 'storage_key': '2d7c41b1-78e7-4607-b495-0d3b0eb06a5b', 'context': 'learning'}, 'storage_key': '2d7c41b1-78e7-4607-b495-0d3b0eb06a5b', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Select the Character Movement component and change the following values:'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'set Max Acceleration = 800.0'}], [{'type': 'paragraph', 'content': 'Max Walk Speed = 600.0'}], [{'type': 'paragraph', 'content': 'Min Analog Walk Speed = 300.0'}, {'type': 'image', 'image_id': 54892, 'caption': '', 'alt_text': '', 'image': {'id': 54892, 'file_name': 'image.png', 'file_size': 55504, 'content_type': 'image/png', 'created_at': '2024-05-02T23:54:41.924+00:00', 'height': 644, 'width': 614, 'storage_key': '0b9af506-6100-41b2-987e-337c3cc17644', 'context': 'learning'}, 'storage_key': '0b9af506-6100-41b2-987e-337c3cc17644', 'context': 'learning', 'width': None}], [{'type': 'paragraph', 'content': 'disable Orient Rotation To Movement'}, {'type': 'image', 'image_id': 54894, 'caption': '', 'alt_text': '', 'image': {'id': 54894, 'file_name': 'image.png', 'file_size': 9628, 'content_type': 'image/png', 'created_at': '2024-05-02T23:56:13.086+00:00', 'height': 117, 'width': 612, 'storage_key': 'e230001f-fd52-45ff-a22c-94d980557e07', 'context': 'learning'}, 'storage_key': 'e230001f-fd52-45ff-a22c-94d980557e07', 'context': 'learning', 'width': None}]]}]


#### 


##### 


##### 

- [{'type': 'paragraph', 'content': "Remove the Jump functionality since that's not relevant to this tutorial"}]
- [{'type': 'paragraph', 'content': "Add three variables that we're going to use to clamp our input scale from the controller"}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'A float variable named RunScale. Set this to 1.0'}], [{'type': 'paragraph', 'content': 'A second float variable named WalkScale. Set this to 0.5'}], [{'type': 'paragraph', 'content': 'A final float variable named RunScaleThreshold. Set this to 0.75'}, {'type': 'image', 'image_id': 54896, 'caption': '', 'alt_text': '', 'image': {'id': 54896, 'file_name': 'image.png', 'file_size': 9285, 'content_type': 'image/png', 'created_at': '2024-05-03T00:10:29.206+00:00', 'height': 175, 'width': 351, 'storage_key': 'a3913aa3-2484-4a7a-84cb-3f1dabff7ace', 'context': 'learning'}, 'storage_key': 'a3913aa3-2484-4a7a-84cb-3f1dabff7ace', 'context': 'learning', 'width': None}]]}]
- [{'type': 'paragraph', 'content': "Add a function called ClampInputScale. We're going to use this function to clamp the input scale that comes from the controller. When the input scale is above RunScaleThreshold, we'll clamp to RunScale, when below, we'll clamp to WalkScale."}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'The function should take a Vector2D variable as an input. Name this InputScale.'}], [{'type': 'paragraph', 'content': 'It should also output a Vector2D named ReturnValue.'}], [{'type': 'paragraph', 'content': 'The function graph should then look as follow:'}, {'type': 'image', 'image_id': 54897, 'caption': '', 'alt_text': '', 'image': {'id': 54897, 'file_name': 'image.png', 'file_size': 283873, 'content_type': 'image/png', 'created_at': '2024-05-03T00:12:23.884+00:00', 'height': 843, 'width': 1501, 'storage_key': 'd9066dce-c13d-478f-bfdb-27060d2138ed', 'context': 'learning'}, 'storage_key': 'd9066dce-c13d-478f-bfdb-27060d2138ed', 'context': 'learning', 'width': None}], [{'type': 'paragraph', 'content': 'Back at the top level of the Event Graph, connect your ClampInputScale function to the IA_Move event:'}, {'type': 'image', 'image_id': 54899, 'caption': '', 'alt_text': '', 'image': {'id': 54899, 'file_name': 'image.png', 'file_size': 166273, 'content_type': 'image/png', 'created_at': '2024-05-03T00:16:00.825+00:00', 'height': 333, 'width': 1650, 'storage_key': '71aae45b-88ed-4777-b86a-aa984de5c6fe', 'context': 'learning'}, 'storage_key': '71aae45b-88ed-4777-b86a-aa984de5c6fe', 'context': 'learning', 'width': None}]]}]


### 


#### 


#### 


##### 

- [{'type': 'paragraph', 'content': 'Set the non-pivot animations to looping. To do this, you may need to open the animation sequences in the animation editor (double-clicking on the assets in the database will open the animation sequence).'}]
- [{'type': 'paragraph', 'content': 'Disable the ‘Reselection of Poses’ flag on the non-pivot animations'}]
- [{'type': 'paragraph', 'content': 'Set the Looping Cost Bias to -0.01. This reduces the cost for the motion matching system to select frames from a looping animation. In other words, it makes selection of the pivot animations less likely.'}]


##### 


##### 


#### 


### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Connect your Trajectory variable to In Out Trajectory'}]
- [{'type': 'paragraph', 'content': 'Create a variable from the In Trajectory Data pin and rename to Trajectory Generation Data'}]
- [{'type': 'paragraph', 'content': 'Hook up the In Delta Time pin to the Get Delta Seconds function'}]
- [{'type': 'paragraph', 'content': 'Connect In Anim Instance to a Self node'}]
- [{'type': 'paragraph', 'content': 'Create a variable from the In Out Desired Controller Yaw Last Update pin and call it PreviousDesiredControllerYaw'}]
- [{'type': 'paragraph', 'content': 'Hookup the rest of the function and set the Trajectory variable'}]


### 


#### 

- [{'type': 'paragraph', 'content': 'Set the Fallback Result to be Asset type and specify PSD_IdleAndStops'}]
- [{'type': 'paragraph', 'content': 'Add an entry to the Context Data, specify Context Object Type Class and enter your animation blueprint (ABP_Mannequin). This allows the Chooser to pull data from your animation blueprint.'}]
- [{'type': 'paragraph', 'content': 'The Output Object Type should be PoseSearchDatabase. This is the type of asset that we want the Chooser to output'}]


#### 

- [{'type': 'paragraph', 'content': 'Two boolean variables, StartedMoving, HasAcceleration'}]
- [{'type': 'paragraph', 'content': 'Three float variables, Acceleration, LastFrameAcceleration, and Speed'}]

- [{'type': 'paragraph', 'content': 'Set Acceleration and LastFrameAcceleration as follows:'}, {'type': 'image', 'image_id': 54721, 'caption': '', 'alt_text': '', 'image': {'id': 54721, 'file_name': 'image.png', 'file_size': 781584, 'content_type': 'image/png', 'created_at': '2024-04-27T04:15:47.476+00:00', 'height': 1030, 'width': 1720, 'storage_key': '1ecd0721-c9aa-4c1f-afd8-70089bcfb96c', 'context': 'learning'}, 'storage_key': '1ecd0721-c9aa-4c1f-afd8-70089bcfb96c', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Now calculate HasAcceleration and StartedMoving as follows:'}, {'type': 'image', 'image_id': 55313, 'caption': '', 'alt_text': '', 'image': {'id': 55313, 'file_name': 'image.png', 'file_size': 177353, 'content_type': 'image/png', 'created_at': '2024-05-20T00:09:23.093+00:00', 'height': 907, 'width': 1329, 'storage_key': '18014367-15ef-4f56-b115-9ed4fd7571fa', 'context': 'learning'}, 'storage_key': '18014367-15ef-4f56-b115-9ed4fd7571fa', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Finally set Speed as follows:'}, {'type': 'image', 'image_id': 54724, 'caption': '', 'alt_text': '', 'image': {'id': 54724, 'file_name': 'image.png', 'file_size': 92514, 'content_type': 'image/png', 'created_at': '2024-04-27T04:18:32.153+00:00', 'height': 611, 'width': 1015, 'storage_key': '508bbc06-51c7-497e-9274-f6473b77a84d', 'context': 'learning'}, 'storage_key': '508bbc06-51c7-497e-9274-f6473b77a84d', 'context': 'learning', 'width': None}]


#### 

- [{'type': 'paragraph', 'content': 'Add two Bool columns and bind them to to the StartedMoving and HasAcceleration variables'}]
- [{'type': 'paragraph', 'content': 'Add a Float Range column and bind it to the Speed variable'}]
- [{'type': 'paragraph', 'content': 'Set the values as follows:'}, {'type': 'image', 'image_id': 55314, 'caption': '', 'alt_text': '', 'image': {'id': 55314, 'file_name': 'image.png', 'file_size': 35768, 'content_type': 'image/png', 'created_at': '2024-05-20T00:12:40.959+00:00', 'height': 282, 'width': 1049, 'storage_key': '11a07106-d9d4-480f-81ff-99c11cda5c1c', 'context': 'learning'}, 'storage_key': '11a07106-d9d4-480f-81ff-99c11cda5c1c', 'context': 'learning', 'width': None}]
- []


#### 


### 


### 


#### 


#### 


### 


#### 


###