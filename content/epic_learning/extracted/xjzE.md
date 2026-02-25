# Game Engines & Shader Stuttering: UE's Solution

*Recently, there have been a number of conversations taking place in the Epic community around shader stuttering and its impact on game developer projects.

This week, we're going to dive into why the phenomenon occurs, explain how PSO precaching can help solve the issue, and explore some development best practices that will help you minimize shader stuttering. We'll also share our future plans for the PSO precaching system with you.*

## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


## 


### 

- [{'type': 'paragraph', 'content': 'Many terabytes of data: Every PSO for every game for every GPU type, architecture, and driver version would be an immense amount of data.'}]
- [{'type': 'paragraph', 'content': 'Can’t crowdsource it: It would be a security risk to allow anyone to upload shaders (which are arbitrary programs) to run on other players’ machines. This means that:'}]
- [{'type': 'paragraph', 'content': 'Developers would still need to manually gather all the PSOs for each game for every GPU type, architecture, and driver version.'}]


### 


### 


## 


#### 


#### 

- [{'type': 'paragraph', 'content': 'An\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine%23validationandtracking#loadingscreen">initial loading screen</a>\xa0should be present while compiling global shaders, use <code class="inline-code">FShaderPipelineCache::NumPrecompilesRemaining()</code> to query how many are left.'}]