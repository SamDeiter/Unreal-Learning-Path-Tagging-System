# Niagara Module: Fire Explosion

*In this module, you will learn how to use Niagara to make a fire explosion particle effect.*

### 

- [{'type': 'paragraph', 'content': 'Open the Plugins menu by going to\xa0Edit\xa0&gt;\xa0Plugins.'}, {'type': 'image', 'image_id': 66204, 'caption': '', 'alt_text': '', 'image': {'id': 66204, 'file_name': '1.png', 'file_size': 76675, 'content_type': 'image/png', 'created_at': '2025-03-20T20:02:47.677+00:00', 'height': 444, 'width': 874, 'storage_key': 'bd4573ad-4f64-423e-93a2-2ff914a4615c', 'context': 'learning'}, 'storage_key': 'bd4573ad-4f64-423e-93a2-2ff914a4615c', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Search for Niagara and click on the checkbox to enable it.\xa0'}, {'type': 'image', 'image_id': 66205, 'caption': '', 'alt_text': '', 'image': {'id': 66205, 'file_name': '2.png', 'file_size': 140759, 'content_type': 'image/png', 'created_at': '2025-03-20T20:06:22.348+00:00', 'height': 800, 'width': 1233, 'storage_key': 'ad7d0d5f-279b-4d66-ad08-0df68d969301', 'context': 'learning'}, 'storage_key': 'ad7d0d5f-279b-4d66-ad08-0df68d969301', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'You will get a prompt to restart the engine. Go ahead and do so. When you jump back in, the plugin will already be enabled.\xa0'}]


### 

- [{'type': 'paragraph', 'content': 'We will start off with a blank level for this project. This means copying the lighting settings from the Level_HOC_world level to the new level you will be creating, to keep the new map thematically similar.\xa0'}]
- [{'type': 'paragraph', 'content': 'With the <b>Level_HOC_world </b>level active, select and copy (CTRL-C) the five main lighting elements needed from the outliner to bring light into your level. You will find these under Level_HOC_world &gt; Env &gt; RenderFX.\xa0'}, {'type': 'callout', 'callout_type': 'info', 'blocks': [{'type': 'paragraph', 'content': 'When you paste these lighting actors in the outliner in the new level, the folder hierarchy will be automatically migrated over. Therefore, manually creating new subfolders to paste these actors into will not be necessary.\xa0'}]}, {'type': 'image', 'image_id': 66207, 'caption': '', 'alt_text': '', 'image': {'id': 66207, 'file_name': '4.png', 'file_size': 36092, 'content_type': 'image/png', 'created_at': '2025-03-20T20:54:45.576+00:00', 'height': 379, 'width': 428, 'storage_key': '29bd85d0-0140-43fa-a193-f6c17d26f999', 'context': 'learning'}, 'storage_key': '29bd85d0-0140-43fa-a193-f6c17d26f999', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': "In the Hour of Code directory inside the Content folder, navigate to the Content &gt; Hour_of_Code &gt; Maps folder where you'll create a new map."}, {'type': 'image', 'image_id': 66206, 'caption': '', 'alt_text': '', 'image': {'id': 66206, 'file_name': '3.png', 'file_size': 31453, 'content_type': 'image/png', 'created_at': '2025-03-20T20:44:51.403+00:00', 'height': 826, 'width': 285, 'storage_key': '6ab7c7a8-6bc6-4bb5-8820-176833c2dbae', 'context': 'learning'}, 'storage_key': '6ab7c7a8-6bc6-4bb5-8820-176833c2dbae', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Double click on the level that was just created. Inside the new level that you just created, paste the files that you copied in the Outliner. The <b>Env &gt; RenderFX</b> folders are automatically created by the engine when you paste the lighting actors in the outliner.\xa0'}, {'type': 'image', 'image_id': 66208, 'caption': '', 'alt_text': '', 'image': {'id': 66208, 'file_name': '5.png', 'file_size': 22596, 'content_type': 'image/png', 'created_at': '2025-03-20T21:22:08.723+00:00', 'height': 253, 'width': 423, 'storage_key': '444f7ed6-7316-4237-a475-8cc1d9884188', 'context': 'learning'}, 'storage_key': '444f7ed6-7316-4237-a475-8cc1d9884188', 'context': 'learning', 'width': None}]


### 


### 


### 


##### 


##### 


### 


##### 


##### 


##### 


##### 


##### 

- [{'type': 'paragraph', 'content': 'Return to the Niagara Editor and select the emitter node named <strong>Fire</strong>. With the <strong>Sprite Renderer</strong> module at the bottom selected, you can assign the <b>M_explosion_subUV </b>material to modify the appearance of the Niagara effect.\xa0\xa0'}, {'type': 'image', 'image_id': 66319, 'caption': '', 'alt_text': '', 'image': {'id': 66319, 'file_name': 'image.png', 'file_size': 12366, 'content_type': 'image/png', 'created_at': '2025-03-22T22:15:30.350+00:00', 'height': 111, 'width': 439, 'storage_key': '1413035a-260d-4f0c-8aad-1f2c14f91350', 'context': 'learning'}, 'storage_key': '1413035a-260d-4f0c-8aad-1f2c14f91350', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Under SubUV, change the Sub Image Size to 6.0 x 6.0, and check the box where it says Sub UV Blending Enabled.\xa0'}, {'type': 'image', 'image_id': 66320, 'caption': '', 'alt_text': '', 'image': {'id': 66320, 'file_name': 'subUV.png', 'file_size': 44606, 'content_type': 'image/png', 'created_at': '2025-03-22T22:18:07.433+00:00', 'height': 711, 'width': 441, 'storage_key': 'd675b0e8-7feb-487e-8c1e-9b19507dfe31', 'context': 'learning'}, 'storage_key': 'd675b0e8-7feb-487e-8c1e-9b19507dfe31', 'context': 'learning', 'width': None}, {'type': 'paragraph', 'content': "When you open up the material to inspect the texture that's being used within, you will see that the sprite sheet (the texture) contains 36 images organized in a 6x6 grid. Each image represents an individual frame that will be played in the explosion animation.\xa0"}, {'type': 'paragraph', 'content': 'Sub UV Blending ensures smooth interpolation between each frame.\xa0'}]


##### 

- [{'type': 'paragraph', 'content': 'Select the <strong>Emitter State</strong> module, then, in the <strong>Details</strong> panel, locate the <strong>Life Cycle</strong> section. Set <strong>Loop Behavior</strong> to <strong>Infinite</strong> to loop the fire effect indefinitely.\xa0\xa0'}, {'type': 'image', 'image_id': 66921, 'caption': '', 'alt_text': '', 'image': {'id': 66921, 'file_name': 'image.png', 'file_size': 35696, 'content_type': 'image/png', 'created_at': '2025-04-04T22:58:22.513+00:00', 'height': 538, 'width': 208, 'storage_key': 'af1cdd22-b1b9-4b82-98e4-ae028b543b00', 'context': 'learning'}, 'storage_key': 'af1cdd22-b1b9-4b82-98e4-ae028b543b00', 'context': 'learning', 'width': None}, {'type': 'image', 'image_id': 66923, 'caption': '', 'alt_text': '', 'image': {'id': 66923, 'file_name': '27.png', 'file_size': 13010, 'content_type': 'image/png', 'created_at': '2025-04-04T23:09:41.883+00:00', 'height': 194, 'width': 438, 'storage_key': 'b65d7636-cd13-4a5c-aaf8-f8e3c07d1247', 'context': 'learning'}, 'storage_key': 'b65d7636-cd13-4a5c-aaf8-f8e3c07d1247', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Click on <b>Spawn Burst Instantaneous</b> and change the Spawn Count to <b>25</b>. This setting controls the number of particles that are spawned.'}, {'type': 'image', 'image_id': 66916, 'caption': '', 'alt_text': '', 'image': {'id': 66916, 'file_name': 'image.png', 'file_size': 38418, 'content_type': 'image/png', 'created_at': '2025-04-04T21:29:55.512+00:00', 'height': 568, 'width': 269, 'storage_key': '4fa4caf0-7972-4cc2-a764-28f7dec777b7', 'context': 'learning'}, 'storage_key': '4fa4caf0-7972-4cc2-a764-28f7dec777b7', 'context': 'learning', 'width': None}, {'type': 'image', 'image_id': 66274, 'caption': '', 'alt_text': '', 'image': {'id': 66274, 'file_name': '15.png', 'file_size': 9145, 'content_type': 'image/png', 'created_at': '2025-03-21T22:44:09.079+00:00', 'height': 161, 'width': 440, 'storage_key': '3aa0f26a-a3ea-43c7-8ffe-e4077668d8cc', 'context': 'learning'}, 'storage_key': '3aa0f26a-a3ea-43c7-8ffe-e4077668d8cc', 'context': 'learning', 'width': None}]


##### 

- [{'type': 'paragraph', 'content': 'Click on the Initialize Particle module and change the Lifetime Min to 0.75 and Lifetime Max to 1.0. This range determines how long each particle will exist before disappearing. Make sure that the Lifetime Mode is set to <b>Random</b>.\xa0'}, {'type': 'image', 'image_id': 66276, 'caption': '', 'alt_text': '', 'image': {'id': 66276, 'file_name': '16.png', 'file_size': 6622, 'content_type': 'image/png', 'created_at': '2025-03-21T22:46:43.798+00:00', 'height': 105, 'width': 436, 'storage_key': '74fef6b9-6bb8-4b26-a6c9-01350de838a2', 'context': 'learning'}, 'storage_key': '74fef6b9-6bb8-4b26-a6c9-01350de838a2', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Under Sprite Attributes, make sure the <b>Sprite Size Mode</b> is set to <b>Random Uniform</b>. For <b>Uniform Sprite Size min</b>, set the value to <b>50.0<i> </i></b>and <b>Uniform Sprite Size Max</b> to <b>85.0</b>. As you can probably guess, the range determines the different values for the size of each particle.\xa0<b>\xa0</b>'}, {'type': 'image', 'image_id': 66277, 'caption': '', 'alt_text': '', 'image': {'id': 66277, 'file_name': 'image.png', 'file_size': 7810, 'content_type': 'image/png', 'created_at': '2025-03-21T22:49:03.755+00:00', 'height': 109, 'width': 440, 'storage_key': 'a8a00057-415a-49ab-ab3c-941fe5c0fe94', 'context': 'learning'}, 'storage_key': 'a8a00057-415a-49ab-ab3c-941fe5c0fe94', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'In the <b>Shape Location</b> module, under the <b>Shape </b>settings, set the <b>Shape Primitive</b> to <b>Sphere </b>with a radius of <b>5.0</b>.'}, {'type': 'image', 'image_id': 66278, 'caption': '', 'alt_text': '', 'image': {'id': 66278, 'file_name': 'image.png', 'file_size': 4921, 'content_type': 'image/png', 'created_at': '2025-03-21T22:51:50.116+00:00', 'height': 79, 'width': 440, 'storage_key': '22040be1-a143-4bef-a387-7baa2dc974d8', 'context': 'learning'}, 'storage_key': '22040be1-a143-4bef-a387-7baa2dc974d8', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'In the Add Velocity module, set the velocity mode to In Cone.\xa0'}, {'type': 'paragraph', 'content': 'Next to Velocity Speed, click on the dropdown arrow and look for Random Range Float. Set the Minimum velocity to 500.0 and Maximum to 800.0.\xa0'}, {'type': 'image', 'image_id': 66279, 'caption': '', 'alt_text': '', 'image': {'id': 66279, 'file_name': 'image.png', 'file_size': 13407, 'content_type': 'image/png', 'created_at': '2025-03-21T22:56:05.814+00:00', 'height': 197, 'width': 439, 'storage_key': 'e7893243-ae35-4997-aaff-dbff3b73a87d', 'context': 'learning'}, 'storage_key': 'e7893243-ae35-4997-aaff-dbff3b73a87d', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'For the <b>Cone </b>settings, set X and Y to <b>0.0</b> and a value of <b>1.0</b> for Z. Change the Cone Angle to 45.0.'}, {'type': 'image', 'image_id': 66280, 'caption': '', 'alt_text': '', 'image': {'id': 66280, 'file_name': 'image.png', 'file_size': 7935, 'content_type': 'image/png', 'created_at': '2025-03-21T22:57:23.083+00:00', 'height': 142, 'width': 439, 'storage_key': '21629598-f082-45cd-a2f3-41a0c2ac39b2', 'context': 'learning'}, 'storage_key': '21629598-f082-45cd-a2f3-41a0c2ac39b2', 'context': 'learning', 'width': None}]


##### 

- [{'type': 'paragraph', 'content': 'Click on the\xa0<b>+ </b>icon and search for Sub UVAnimation.\xa0'}, {'type': 'image', 'image_id': 66281, 'caption': '', 'alt_text': '', 'image': {'id': 66281, 'file_name': '21.png', 'file_size': 28472, 'content_type': 'image/png', 'created_at': '2025-03-21T23:00:21.485+00:00', 'height': 513, 'width': 650, 'storage_key': 'f56e8db9-1afb-488c-9ab3-68a42c717409', 'context': 'learning'}, 'storage_key': 'f56e8db9-1afb-488c-9ab3-68a42c717409', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': "Refer back to the details panel, and you'll see a warning under the Sprite Renderer settings. To resolve this, choose Sprite Renderer in the dropdown next to the Sprite Renderer option."}, {'type': 'image', 'image_id': 66282, 'caption': '', 'alt_text': '', 'image': {'id': 66282, 'file_name': 'image.png', 'file_size': 15939, 'content_type': 'image/png', 'created_at': '2025-03-21T23:09:29.165+00:00', 'height': 194, 'width': 443, 'storage_key': 'b3c365d8-b7d2-4444-a395-70f166155900', 'context': 'learning'}, 'storage_key': 'b3c365d8-b7d2-4444-a395-70f166155900', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Under the Setup settings, check the boxes next to <b>Start Frame Range</b> and <b>End Frame Range</b>. Set the values to 0 and 35, respectively.\xa0'}, {'type': 'image', 'image_id': 66283, 'caption': '', 'alt_text': '', 'image': {'id': 66283, 'file_name': 'image.png', 'file_size': 8614, 'content_type': 'image/png', 'created_at': '2025-03-21T23:12:31.305+00:00', 'height': 140, 'width': 438, 'storage_key': '2658586e-518d-4f3b-b13c-0a35bbb67ddb', 'context': 'learning'}, 'storage_key': '2658586e-518d-4f3b-b13c-0a35bbb67ddb', 'context': 'learning', 'width': None}]


### 


###