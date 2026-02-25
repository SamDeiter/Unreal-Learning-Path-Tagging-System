# Mastering Async Loading in Unreal Engine

*This tutorial explains how async loading works and how to best leverage it.*

## 


## 


#### 

- [{'type': 'paragraph', 'content': 'To create a UObject from a worker thread, you need to hold a <code class="inline-code">FGCScopeGuard</code>.'}]

- [{'type': 'paragraph', 'content': 'UObject created on worker threads will automatically have\xa0<code class="inline-code">EInternalObjectFlags::Async</code>\xa0so they don’t get garbage collected until you have the chance to establish a relationship with some other UObject that are rooted and discoverable by the GC. Removing that flag is the responsibility of the thread that created the object, in this case, the loader itself.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': 'You cannot overwrite a UObject with a new UObject of the same name from worker threads as the old UObject’s destructor is not safe to call outside of the game thread.'}]


#### 


## 


#### 


#### 


#### 


#### 


#### 


#### 


#### 


## 


```

```


```

```


```

```


## 

- [{'type': 'paragraph', 'content': 'To best utilize async loading, we need to avoid flushes of the loading pipeline as much as possible. Each flush means we need to synchronize with the game thread and is a lost opportunity to have more work overlap on more than a single thread.'}]
- [{'type': 'paragraph', 'content': 'Defer delegate registration to Postload or later during loading'}]
- [{'type': 'paragraph', 'content': 'Defer global system interactions to Postload or later during loading'}]
- [{'type': 'paragraph', 'content': 'Avoid UI interactions from functions called by the loader'}]
- [{'type': 'paragraph', 'content': 'Avoid Transaction system interactions from functions called by the loader'}]
- [{'type': 'paragraph', 'content': 'Custom serialization code should touch only the object being serialized'}]
- [{'type': 'paragraph', 'content': 'Defer synchronous loads to Postload or later during loading'}]
- [{'type': 'paragraph', 'content': 'Avoid making decisions based on global variables from functions called by the loader.'}]


##