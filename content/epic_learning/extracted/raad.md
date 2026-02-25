# Shot Management with the Cinematic Assembly Tools (CAT)

*An overview of the Cinematic Assembly Tools in Unreal Engine 5.6. Learn how to use this new toolset to easily configure your projects, templatize your cinematics, and automate your shot management pipeline.*

## 


## 


## 


### 


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Frame Rate - Sets the Display Rate in Sequencer that will be set when first opening a Sequence'}]
- [{'type': 'paragraph', 'content': 'Sequencer Start Frame - Sets the first frame in the frame range of the Sequence'}]
- [{'type': 'paragraph', 'content': 'Subsequence Priority - Also referred to as Hierarchical Bias, determines whether Subsequences override parent sequences (Bottom Up), or the other way around (Top Down).'}]


#### 


#### 


#### 


## 


### 

- [{'type': 'paragraph', 'content': 'Level - The Level that will open anytime you open this Assembly in Sequencer (defaults to the currently open level)'}]
- [{'type': 'paragraph', 'content': 'Parent Assembly - The Assembly sequence in which this Assembly will be placed'}]
- [{'type': 'paragraph', 'content': 'Production - The Production that this Assembly is associated with (default to the current Active Production)'}]
- [{'type': 'paragraph', 'content': 'Instance Metadata - A list of string-based key/value pairs allowing you to associate arbitrary metadata fields with this Assembly.'}]

- [{'type': 'paragraph', 'content': 'Open Map - Opens the level associated with this Assembly, but does not open anything in Sequencer'}]
- [{'type': 'paragraph', 'content': 'Open in Current Map - Opens the Assembly in Sequencer but does not open the associated level'}]
- [{'type': 'paragraph', 'content': 'Edit Properties - Opens a dockable tab displaying a preview of the Assembly, the Notes, and the Details properties.'}]


### 

- [{'type': 'paragraph', 'content': 'Default Assembly Name - The default name that will be used for Assemblies made from this schema. It supports naming tokens, allowing you to set a naming convention for Cine Assemblies of this type.'}]
- [{'type': 'paragraph', 'content': 'Parent Schema - Restricts the Assembly Type of the Parent Assembly property when making Assemblies from this schema. In this example, the Parent of UnrealShot Assemblies is restricted to UnrealScene Assemblies.'}]
- [{'type': 'paragraph', 'content': 'Thumbnail Image - Assigns a texture asset to use for the thumbnail of this Schema and as the default thumbnail for Assemblies made from this Schema.'}]

- [{'type': 'paragraph', 'content': 'String'}]
- [{'type': 'paragraph', 'content': 'Boolean'}]
- [{'type': 'paragraph', 'content': 'Integer'}]
- [{'type': 'paragraph', 'content': 'Float'}]
- [{'type': 'paragraph', 'content': 'Asset Path (for referencing other UAssets)'}]
- [{'type': 'paragraph', 'content': 'Cine Assembly (for referencing other Assemblies)'}]


### 

- [{'type': 'paragraph', 'content': 'The Assembly Name field has been prepopulated with the Default Assembly Name property from the Schema.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Clicking in the text box widget will display the token string, and also allow you to change the name if you do not want to use the Default name from the Schema.'}]]}]
- [{'type': 'paragraph', 'content': 'The Parent Assembly field is restricted to UnrealScene Assemblies. In this example, we have specified that our new UnrealShot’s parent is Scene1.'}]
- [{'type': 'paragraph', 'content': 'There is a new details section, UnrealShot Metadata, which has a property called shotNum with a numeric entry widget and a default value of 1000. Metadata properties in the section are defined in the schema and will be present on all assemblies derived from this schema.'}]
- [{'type': 'paragraph', 'content': 'There is a new details section, Subsequences, which lists all of the subsequences defined in the Schema that will be automatically created as part of this Assembly.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The default names were specified in the Schema, but you can choose to rename these subsequences'}], [{'type': 'paragraph', 'content': 'You can also use the checkboxes next to each row to disable the creation of that subsequence for this particular Assembly.'}]]}]
- [{'type': 'paragraph', 'content': 'The text of the Create button has changed as a final reminder of what Assembly type you are about to create.'}]


## 


### 


### 


## 


### 


#### 

- [{'type': 'paragraph', 'content': 'Production ID - The FGuid of the Production you want to rename'}]
- [{'type': 'paragraph', 'content': 'New Name - The new name for the Production'}]


#### 

- [{'type': 'paragraph', 'content': 'Schema - The Cine Schema asset to use when creating this Assembly. Naming conventions, default metadata, and default subsequences will all be set by the chosen Schema'}]
- [{'type': 'paragraph', 'content': 'Level - The Level that will open anytime you open this Assembly in Sequencer'}]
- [{'type': 'paragraph', 'content': 'Parent Assembly - The Assembly sequence in which this Assembly will be placed.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Note: there is no validation to enforce that the chosen Parent matches the type of the Schema’s Parent Schema setting.'}]]}]
- [{'type': 'paragraph', 'content': 'Metadata - A Map of Key/Value string pairs that will be added to the Assembly.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Note: If you intend to use the Default Assembly Name defined in the Schema, you must input all of the metadata fields used as part of the assembly name.'}]]}]
- [{'type': 'paragraph', 'content': 'Path - The location in Content Browser where this Assembly should be created'}]
- [{'type': 'paragraph', 'content': 'Name - Optional Name to use for the Assembly Asset if Use Default Name from Schema is unchecked'}]
- [{'type': 'paragraph', 'content': 'Use Default Name From Schema - If checked, the Default Assembly Name defined in the Schema will be used to name the Assembly asset'}]

- [{'type': 'paragraph', 'content': 'Out Value - The value associated with the input key, formatted as a string. If the key was not found, or could not be formatted correctly, this will be an empty string.'}]
- [{'type': 'paragraph', 'content': 'Found Key - True if the key was found in the metadata map, false otherwise'}]

- [{'type': 'paragraph', 'content': 'Out Value - The value associated with the input key, formatted as a bool. If the key was not found, or could not be formatted correctly, this will be false.'}]
- [{'type': 'paragraph', 'content': 'Found Key - True if the key was found in the metadata map, false otherwise'}]

- [{'type': 'paragraph', 'content': 'Out Value - The value associated with the input key, formatted as an integer. If the key was not found, or could not be formatted correctly, this will be 0.'}]
- [{'type': 'paragraph', 'content': 'Found Key - True if the key was found in the metadata map, false otherwise'}]

- [{'type': 'paragraph', 'content': 'Out Value - The value associated with the input key, formatted as a float. If the key was not found, or could not be formatted correctly, this will be 0.'}]
- [{'type': 'paragraph', 'content': 'Found Key - True if the key was found in the metadata map, false otherwise'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The string value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The boolean value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The integer value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The float value to associate with that key'}]


### 


#### 

- [{'type': 'paragraph', 'content': 'production_id - The Guid of the Production you want to rename'}]
- [{'type': 'paragraph', 'content': 'new_name - The new name for the Production'}]


#### 

- [{'type': 'paragraph', 'content': 'schema - The Cine Schema asset to use when creating this Assembly. Naming conventions, default metadata, and default subsequences will all be set by the chosen Schema'}]
- [{'type': 'paragraph', 'content': 'level - The Level that will open anytime you open this Assembly in Sequencer'}]
- [{'type': 'paragraph', 'content': 'parent - The Assembly sequence in which this Assembly will be placed.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Note: there is no validation to enforce that the chosen Parent matches the type of the Schema’s Parent Schema setting.'}]]}]
- [{'type': 'paragraph', 'content': 'metadata_map - A Map of Key/Value string pairs that will be added to the Assembly.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Note: If you intend to use the Default Assembly Name defined in the Schema, you must input all of the metadata fields used as part of the assembly name.'}]]}]
- [{'type': 'paragraph', 'content': 'path - The location in Content Browser where this Assembly should be created'}]
- [{'type': 'paragraph', 'content': 'assembly_name - Optional Name to use for the Assembly Asset if Use Default Name from Schema is unchecked'}]
- [{'type': 'paragraph', 'content': 'use_default_name_from_schema - If checked, the Default Assembly Name defined in the Schema will be used to name the Assembly asset'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The string value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The boolean value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The integer value to associate with that key'}]

- [{'type': 'paragraph', 'content': 'In Key - The metadata key to add to the map'}]
- [{'type': 'paragraph', 'content': 'In Value - The float value to associate with that key'}]