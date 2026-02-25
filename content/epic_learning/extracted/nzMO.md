# Enabling Baked Lighting in UE5

*The setting changes and setup needed to bake lighting in Unreal Engine 5.*

## 

- [{'type': 'paragraph', 'content': 'Open the\xa0<b>Project Settings</b>\xa0window.'}]
- [{'type': 'paragraph', 'content': 'Navigate to the <b>Engine - Rendering</b> section.'}]
- [{'type': 'paragraph', 'content': 'Set <b>Allow Static Lighting</b> to <b>true</b>.'}, {'type': 'image', 'image_id': 64195, 'caption': '', 'alt_text': 'Project Settings window, with the Allow Static Lighting option set to true.', 'image': {'id': 64195, 'file_name': 'Screenshot 2025-01-21 133348.png', 'file_size': 7988, 'content_type': 'image/png', 'created_at': '2025-01-22T21:05:11.838+00:00', 'height': 109, 'width': 627, 'storage_key': 'abe6feb3-8efd-4a89-ba4b-5e13d87bd776', 'context': 'learning'}, 'storage_key': 'abe6feb3-8efd-4a89-ba4b-5e13d87bd776', 'context': 'learning', 'width': None}]


## 


### 

- [{'type': 'paragraph', 'content': 'Open the\xa0<b>Project Settings</b> window.'}]
- [{'type': 'paragraph', 'content': 'Navigate to the\xa0Engine - Rendering\xa0section.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': 'Set\xa0<b>Dynamic Global Illumination Method</b> to <b>None</b>.'}, {'type': 'image', 'image_id': 64208, 'caption': '', 'alt_text': 'Project Settings window, with Dynamic Global Illumination Method highlighted and set to None.', 'image': {'id': 64208, 'file_name': 'Screenshot 2025-01-22 165252.png', 'file_size': 15633, 'content_type': 'image/png', 'created_at': '2025-01-23T01:27:08.887+00:00', 'height': 190, 'width': 624, 'storage_key': '2fe32d73-db05-4bbb-a44c-ebad3f5ce72f', 'context': 'learning'}, 'storage_key': '2fe32d73-db05-4bbb-a44c-ebad3f5ce72f', 'context': 'learning', 'width': None}, {'type': 'callout', 'callout_type': 'note', 'blocks': [{'type': 'paragraph', 'content': 'If your project has <b>Forward Rendering</b> enabled, this setting will be greyed out and un-selectable. This indicates that the setting is not supported with your current project configuration, and Lumen will not be used in your project.\xa0\xa0'}]}]


### 

- [{'type': 'paragraph', 'content': 'Add a <b>Post Process Volume</b> to your level.'}]
- [{'type': 'paragraph', 'content': "In the Volume's <b>Details Panel</b>, navigate to the <b>Global Illumination</b> section."}]
- [{'type': 'paragraph', 'content': 'Set <b>Method</b> to <b>None</b>.'}, {'type': 'image', 'image_id': 64209, 'caption': '', 'alt_text': 'Details Panel for the PostProcess Volume, with the Method setting highlighted and set to None.', 'image': {'id': 64209, 'file_name': 'Screenshot 2025-01-22 173433.png', 'file_size': 32193, 'content_type': 'image/png', 'created_at': '2025-01-23T01:35:10.261+00:00', 'height': 356, 'width': 499, 'storage_key': 'ca3fadc3-ab7e-4bc8-8a39-90a7b76003af', 'context': 'learning'}, 'storage_key': 'ca3fadc3-ab7e-4bc8-8a39-90a7b76003af', 'context': 'learning', 'width': None}, {'type': 'paragraph', 'content': 'The steps above will disable Lumen only <i>within </i>the bounds of the Post Process Volume. If you want your Post Process Volume (including disabling Lumen) to affect the <i>entire</i> level, you can continue through the steps listed below.\xa0'}]
- [{'type': 'paragraph', 'content': 'Navigate to the <b>Post Process Volume Settings</b> section.'}]
- [{'type': 'paragraph', 'content': 'Set<b> Infinite Extend (Unbound)</b> to <b>true</b>.\xa0'}, {'type': 'image', 'image_id': 64210, 'caption': '', 'alt_text': 'Details Panel of Post Process Volume, with Infinite Extent setting setting highlighted and set to true.', 'image': {'id': 64210, 'file_name': 'Screenshot 2025-01-22 173721.png', 'file_size': 12255, 'content_type': 'image/png', 'created_at': '2025-01-23T01:38:12.951+00:00', 'height': 193, 'width': 478, 'storage_key': '8099befb-1f2a-4762-a361-3965deab13bc', 'context': 'learning'}, 'storage_key': '8099befb-1f2a-4762-a361-3965deab13bc', 'context': 'learning', 'width': None}]


## 


### 

- [{'type': 'paragraph', 'content': 'Open the <b>New Level</b> window.'}]
- [{'type': 'paragraph', 'content': 'Select either the\xa0<b>Basic\xa0</b>or\xa0<b>Empty Level\xa0</b>template. These two templates have World Partition disabled by default.'}]
- [{'type': 'paragraph', 'content': 'Select the <b>Create </b>button, and follow the subsequent steps to make a new level.'}, {'type': 'image', 'image_id': 64191, 'caption': '', 'alt_text': 'New Level window, with the Basic Level item selected', 'image': {'id': 64191, 'file_name': 'Screenshot 2025-01-21 134948.png', 'file_size': 54997, 'content_type': 'image/png', 'created_at': '2025-01-22T20:44:10.740+00:00', 'height': 453, 'width': 531, 'storage_key': 'b79af6cd-b424-43c0-a655-48c3db67cbfc', 'context': 'learning'}, 'storage_key': 'b79af6cd-b424-43c0-a655-48c3db67cbfc', 'context': 'learning', 'width': None}]


### 

- [{'type': 'paragraph', 'content': 'In the <b>World Settings</b> window, navigate to the <b>World Partition Setup</b> section.'}]
- [{'type': 'paragraph', 'content': 'Set\xa0<b>Enable Streaming\xa0</b>to\xa0<b>false</b>.\xa0\xa0'}, {'type': 'image', 'image_id': 64211, 'caption': '', 'alt_text': 'World Settings window, with the Enable Streaming setting highlighted and set to false.', 'image': {'id': 64211, 'file_name': 'Screenshot 2025-01-22 174804.png', 'file_size': 18416, 'content_type': 'image/png', 'created_at': '2025-01-23T01:48:54.747+00:00', 'height': 203, 'width': 497, 'storage_key': 'dddf5a31-89b8-4677-9a63-481f2f6f5489', 'context': 'learning'}, 'storage_key': 'dddf5a31-89b8-4677-9a63-481f2f6f5489', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'In the <b>Advanced</b> subsection, click the <b>Disable World Partition</b> button.'}, {'type': 'image', 'image_id': 64188, 'caption': '', 'alt_text': 'World Settings window, with the Disable World Partition setting and its Disable button highlighted.', 'image': {'id': 64188, 'file_name': 'Screenshot 2025-01-21 135132.png', 'file_size': 11858, 'content_type': 'image/png', 'created_at': '2025-01-22T20:36:13.409+00:00', 'height': 166, 'width': 475, 'storage_key': '355f7c22-f32d-40a1-b832-6d184f8c1dd6', 'context': 'learning'}, 'storage_key': '355f7c22-f32d-40a1-b832-6d184f8c1dd6', 'context': 'learning', 'width': None}, {'type': 'callout', 'callout_type': 'warning', 'blocks': [{'type': 'paragraph', 'content': 'In engine versions 5.4 or earlier, this may trigger a known bug where the viewport and outliner appear empty. To restore level assets, save and re-open your level.'}]}]


## 

- [{'type': 'paragraph', 'content': '\xa0 In the<b>\xa0World Settings</b>\xa0window, navigate to the<b>\xa0Lightmass\xa0</b>section.\xa0 \xa0\xa0'}]
- [{'type': 'paragraph', 'content': '\xa0 In the\xa0<b>Advanced\xa0</b>subsection, set<b>\xa0Force No Precomputed Lighting\xa0</b>to<b>\xa0false</b>.\xa0\xa0'}, {'type': 'image', 'image_id': 64238, 'caption': '', 'alt_text': 'World Settings window, with the Force No Precomputed Lighting setting highlighted and set to false.', 'image': {'id': 64238, 'file_name': 'Screenshot 2025-01-21 135251.png', 'file_size': 11487, 'content_type': 'image/png', 'created_at': '2025-01-23T22:22:40.148+00:00', 'height': 162, 'width': 476, 'storage_key': '710617d8-f441-492b-9aeb-3c90e3719e99', 'context': 'learning'}, 'storage_key': '710617d8-f441-492b-9aeb-3c90e3719e99', 'context': 'learning', 'width': None}]


## 


##