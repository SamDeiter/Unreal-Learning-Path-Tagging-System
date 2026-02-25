# Creating A Content Only Plugin In Unreal Engine

*A best practice in Unreal Engine is to create a Content-Only Plugin in Unreal to collect and share your assets, such as blueprints, editor utility widgets, libraries of materials, or any other content you want to share between projects or manage outside the project itself. This tutorial will teach you how to create a Content-Only Plugin for your project.*

### 


### 


### 

- [{'type': 'paragraph', 'content': 'Icon (...): Set the icon thumbnail for the plugin in the UI.'}]
- [{'type': 'paragraph', 'content': 'Version Name: Defines a user-defined string to number the release of the plugin.\xa0'}]
- [{'type': 'paragraph', 'content': 'Friendly Name: This is where we can decouple the name we chose earlier to keep a manageable file path length. The field will define the plugin name displayed in the Plugin Browser.'}]
- [{'type': 'paragraph', 'content': 'Description: Defines the description text in the Plugin Browser entry.'}]
- [{'type': 'paragraph', 'content': 'Category: Defines a Category to group to organize the Plugin Browser. If the Category does not already exist, it will be created based on your entry.\xa0'}]
- [{'type': 'paragraph', 'content': 'Created By: This is the Author field to specify the creator or maintainer of the plugin.\xa0'}]
- [{'type': 'paragraph', 'content': "Created By URL: Optional URL to link to the Author's URL"}]
- [{'type': 'paragraph', 'content': 'Docs URL: Optional URL to link to external documentation for the Plugin.'}]
- [{'type': 'paragraph', 'content': 'Marketplace URL: Only for Marketplace published assets to link to their landing page.'}]
- [{'type': 'paragraph', 'content': 'Support URL: Optional URL to link to the support resources for the plugin.'}]
- [{'type': 'paragraph', 'content': "Editor Custom Virtual Path: An optional custom virtual path to display in the Editor to better organize. Inserted just before this plugin's directory in the path: /All/Plugins/EditorCustomVirtualPath/PluginName."}]
- [{'type': 'paragraph', 'content': 'Can Contain Content: Informs the Editor that this plugin can contain content and is not code only.'}]
- [{'type': 'paragraph', 'content': 'Is Beta Version: This will enable the Beta tag in the entry in the Plugin Browser.\xa0'}]
- [{'type': 'paragraph', 'content': 'Is Enabled by Default:\xa0Whether this plugin should be enabled by default for all projects.'}]
- [{'type': 'paragraph', 'content': "Explicitly Loaded: When true, this plugin's modules will not be loaded automatically, nor will its content be mounted automatically. It will load/mount when explicitly requested, and LoadingPhases will be ignored."}]
- [{'type': 'paragraph', 'content': 'Is Sealed:\xa0Prevents other plugins from depending on this plugin.'}]
- [{'type': 'paragraph', 'content': 'No Code: Prevents this plugin from containing code or modules.'}]
- [{'type': 'paragraph', 'content': 'Dependencies: Used to enforce dependencies on the plugin and the loading sequence.\xa0'}]


### 

- [{'type': 'paragraph', 'content': 'Use the version numbering to manage your releases, along with documentation, to maintain and release a useful plugin across your projects. Archive your releases to keep track of your versions for future reference.'}]
- [{'type': 'paragraph', 'content': 'You can access the Experimental tag for your plugin by opening the Uplugin file with a text editor. This will allow you to access some additional properties not exposed by the Plugin Properties window.'}]
- [{'type': 'paragraph', 'content': 'It is critical to handle your references in your project. Moving or migrating assets into your plugin content directory is very easy; just be sure to clean up your redirectors!'}]


### 


#### 


#### 


##### 


##### 


### 


####