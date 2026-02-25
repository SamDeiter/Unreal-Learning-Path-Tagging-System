# Hair Card Generator

*Generate procedural hair cards from hair strands*

## 


## 


## 

- [{'type': 'paragraph', 'content': '<b>Number of cards</b>: controls the amount of cards that will be generated (the final amount can vary slightly).'}]
- [{'type': 'paragraph', 'content': '<b>Number of textures</b>: controls the number of unique textures that will be present in the texture atlas. If the number of textures is smaller than the number of cards, some cards will share textures.'}]
- [{'type': 'paragraph', 'content': '<b>Number of triangles</b>: controls the target number of triangles of the final mesh. For a given number of cards, increasing the number of triangles increases the amount by which the cards are subdivided. Since the card subdivisions are controlled by an adaptive subdivision algorithm that creates more subdivisions in curved areas, the final amount of geometry will vary slightly with respect to the target setting.'}]
- [{'type': 'paragraph', 'content': "<b>Max flyaway cards</b>: flyaway cards are cards that contain a single hair strand, that typically doesn't follow the shape of the main hair flow. This parameter defines the maximum number of these cards that will be generated. Flyaway cards can very significantly improve the realism of the final hair, but use a large amount of geometry, so they are typically used in the lowest LODs."}]


## 

- [{'type': 'paragraph', 'content': '<b>Independent assets.</b>\xa0If each LOD is allowed to have its own assets (mesh and texture atlases), it is possible to create a new card asset in the <b>cards</b> tab of the groom editor, set the desired LOD index for it and run the Hair Card Generator with the options wanted for this LOD.'}]
- [{'type': 'paragraph', 'content': '<b>Reduce Cards From Previous LOD</b>. If a cards asset was already generated, it is possible to re-use the existing texture atlas in a new LOD. To do this, activate the\xa0<b>Reduce Cards From Previous LOD</b> option. After doing that, the only available options will be the number of triangles and the flyaway cards. This will create a new asset with the same number of cards than the previous LOD, but each card can have less subdivisions and flyaway cards can be discarded.'}, {'type': 'paragraph', 'content': 'In the following example, LOD 1 was created by using the same cards as LOD 0 (created before), but aiming for 20k total triangles instead of 35k, and eliminating flyaways. The textures look very similar, because the same textures are used for each card.'}, {'type': 'image', 'image_id': 53750, 'caption': 'Reduce Cards From Previous LOD example', 'alt_text': 'Reduce Cards From Previous LOD example', 'image': {'id': 53750, 'file_name': 'LOD.gif', 'file_size': 893933, 'content_type': 'image/gif', 'created_at': '2024-04-17T09:16:32.269+00:00', 'height': 1048, 'width': 818, 'storage_key': 'f8e14018-0457-4fa6-a67d-a249ed8383fd', 'context': 'learning'}, 'storage_key': 'f8e14018-0457-4fa6-a67d-a249ed8383fd', 'context': 'learning', 'width': 500, 'autoplay': True}, {'type': 'image', 'image_id': 53764, 'caption': 'Reduce Cards From Previous LOD atlas', 'alt_text': 'Reduce Cards From Previous LOD atlas', 'image': {'id': 53764, 'file_name': 'image.png', 'file_size': 530920, 'content_type': 'image/png', 'created_at': '2024-04-17T11:43:34.779+00:00', 'height': 1000, 'width': 1000, 'storage_key': '98b5a3d0-f8d0-4592-9e4a-b733a49a0e70', 'context': 'learning'}, 'storage_key': '98b5a3d0-f8d0-4592-9e4a-b733a49a0e70', 'context': 'learning', 'width': 500}]
- [{'type': 'paragraph', 'content': '<b>Reserve texture space</b>. If the goal is to share the texture atlases between the different LODs, but not sharing the textures themselves, it is also possible to dedicate different areas of a texture atlas for different LODs. For this, first it is necessary to create the finer LOD setting the\xa0<b>Reserve Texture Space LOD</b>\xa0option to the percentage of the texture atlas that will be reserved for the later LODs. Then, the next LOD must be created using the option<b> Use Reserved Space From Previous LOD.</b>'}, {'type': 'paragraph', 'content': "In the following example, LOD 1 was created by reducing the number of cards, which this method allows, and the total number of triangles. In this case, LOD 0 and LOD 1 don't look as similar as in the previous case, because different cards and textures are used. As a trade-off, LOD 1 can be better optimized."}, {'type': 'image', 'image_id': 53755, 'caption': 'Reserve Texture Space example', 'alt_text': 'Reserve Texture Space example', 'image': {'id': 53755, 'file_name': 'LODb.gif', 'file_size': 895828, 'content_type': 'image/gif', 'created_at': '2024-04-17T11:20:48.598+00:00', 'height': 1048, 'width': 818, 'storage_key': '8718fef8-a1a8-495c-8d27-fa71e1f86243', 'context': 'learning'}, 'storage_key': '8718fef8-a1a8-495c-8d27-fa71e1f86243', 'context': 'learning', 'width': 500, 'autoplay': True}, {'type': 'image', 'image_id': 53762, 'caption': 'Reserve Texture Space atlas', 'alt_text': 'Reserve Texture Space atlas', 'image': {'id': 53762, 'file_name': 'image.png', 'file_size': 588149, 'content_type': 'image/png', 'created_at': '2024-04-17T11:33:39.258+00:00', 'height': 1000, 'width': 1000, 'storage_key': 'c3047ff0-5540-482d-af7f-b61e98bb23f1', 'context': 'learning'}, 'storage_key': 'c3047ff0-5540-482d-af7f-b61e98bb23f1', 'context': 'learning', 'width': 500}]


## 


##