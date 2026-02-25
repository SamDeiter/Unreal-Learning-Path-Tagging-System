# Handling UI navigation with MVVM and Common Activatable Widgets

*This tutorial shows how to handle UI navigation on a screen in a simple and flexible way, using MVVM (the Model View ViewModel pattern) to create a Selection View Model and Common Activatable Widgets to manage focus. The process requires zero coding, and will be focused on UMG and blueprint-based MVVM.

We will implement a focus-based navigation in a simple screen where elements like lists, tiles and buttons communicate with each other using the Selection View Model and with the help of Common Activatable Widgets.*

### 

- [{'type': 'paragraph', 'content': 'The power of the MVVM pattern'}]
- [{'type': 'paragraph', 'content': 'What is a Selection View Model'}]
- [{'type': 'paragraph', 'content': 'How to create and use the Selection View Model'}]
- [{'type': 'paragraph', 'content': 'How Slate handles focus'}]
- [{'type': 'paragraph', 'content': 'The power of Common Activatable Widgets'}]


##### 


##### 


##### 


### 


### 

- [{'type': 'paragraph', 'content': 'Create the Selection View Model in blueprint'}]
- [{'type': 'paragraph', 'content': 'Find a place to construct it and instantiate it, so that all the widgets can use the same instance'}]
- [{'type': 'paragraph', 'content': 'Add Views for the Selection VM into our widget and create the bindings we need to handle the navigation'}]
- [{'type': 'paragraph', 'content': 'Add setter functions to our Selection VM in order to centralize common operations and keep the properties in sync'}]


### 

- [{'type': 'paragraph', 'content': 'In order to fix them, we need to understand what Slate focus is and how it works\xa0'}]
- [{'type': 'paragraph', 'content': 'We will then see how Common Activatable Widgets can help us handle focus without going insane, and how we can make our focus evaluation hierarchical by using Get Desired Focus Target'}]
- [{'type': 'paragraph', 'content': "Finally we'll see how we can re-evaluate focus on demand by using Request Refresh Focus"}]


##### 


##### 


#### 

- [{'type': 'paragraph', 'content': 'When you switch between mouse and gamepad,\xa0<code class="inline-code">GetDesiredFocusTarget()</code>\xa0is called and focus is re-evaluated. This doesn’t happen when you switch between mouse and keyboard. That’s because UE assumes you might still be using mouse-based navigation alongside keyboard shortcuts.'}]
- [{'type': 'paragraph', 'content': 'This is annoying when we want to implement a focus-based navigation, because we have no way of automatically refreshing the focus when switching from mouse to keyboard.'}]
- [{'type': 'paragraph', 'content': 'The other annoying thing is that when you click on a non-focusable widget (like a background image or border, or even a button that is hit-testable but not focusable, like our Equip and Junk buttons), Unreal sets focus to the viewport instead of maintaining focus within the UI, which is pretty much the equivalent of losing focus. Then, when you switch to keyboard, no widget is focused, so navigation doesn’t work\xa0— but if you switch to gamepad, Unreal detects an input method change, so it will trigger a focus re-evaluation, calling the various\xa0<code>GetDesiredFocusTarget()</code>\xa0functions.\xa0\xa0'}]


### 


###