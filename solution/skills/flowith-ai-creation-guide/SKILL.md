---
name: flowith-ai-creation-guide
description: |
  Create images/videos with Flowith AI canvas-based creation tool.
  Use when at flowith.io for AI image/video generation, PPTs, code, websites,
  and uploading deliverables to the Knowledge Garden.
---

# Task Workflows

## Workflow 1: Generate Content via Flowith

---

name: generate_content_via_Flowith
description: Generate images, text, videos, PPT, code, and websites by creating new nodes in Flowith

---

### Instruction

1. Open https://flowith.io/ or https://flowith.net
2. If this query has files that need to be injected as context, upload the files to the "Upload File" element in the bottom right of the input box through the upload_file Action. Do not directly click that element to upload.
3. Determine whether you are currently on the canvas or homepage: When the input box is at the bottom of the page, you are on the canvas; when the input box is in the middle of the page, you are on the homepage.
4. Refer to the "Two modes supported by Flowith" below to decide whether to invoke Neo or Regular Mode.
   a. If invoking Regular Mode: Execute the "Invoke model from homepage" operation when on the homepage, or execute the "Invoke model on canvas" operation when on the canvas.
   b. If invoking Agent Neo, execute the "Invoke Agent Neo" operation.
5. Locate the input box on the page, enter the question/request you want to ask the AI, and press Enter while the input box is active.
6. Wait for content generation. If you invoked Agent Neo earlier, you can wait 5 minutes, then check the step list in the left column of the page to see if there is text like "Estimated N more steps remaining." If so, continue waiting until all steps are completed, then click the last step and the page will automatically navigate to the node corresponding to the final output. If you invoked a video generation model earlier, wait 5 minutes and check if the video has been generated; if it's still generating, wait another 10 minutes. If it still hasn't been generated, re-execute the operation in step 4 by re-entering the query in the bottom input box to create a new node and wait for generation. If you invoked other models, wait up to 3 minutes. If nothing has been generated yet, re-execute the operation in step 4 by re-entering the query in the bottom input box to create a new node and wait for generation.

**_ Two Modes Supported by Flowith _**
Flowith canvas supports two modes to answer or execute each query: 1. Regular Mode (invokes regular LLM models or tools, with various basic and advanced models available, covering scenarios such as reasoning Q&A, online search, image/video generation, prompt enhancement, etc. Suitable for completing tasks that only require one question and one answer to achieve ideal results, at a lower cost) 2. Agent Mode (invokes Agent Neo, a highly advanced agent system that can deeply think about a query and dynamically plan the necessary steps, calling one or even multiple parallel tools at each step to ultimately deliver a very solid output. Suitable for completing large-scale generative tasks or even periodic tasks that require multiple steps, such as conducting in-depth research, building a website for a brand, developing a web game, etc., at a higher cost)

# Primitive Operations

## Operation 1 Extract Deliverables

name: Extract Deliverables
description: Extract the output from a specified node

---

### Instruction

1. Click on the blank area outside the input box on the canvas to ensure the focus is not on the input box.
2. Find the node corresponding to the target file to be extracted on the canvas.
   a. If the target node is an image or video:
   i. Based on the format of the target file (image or video), use the Extract_structured_data Action to obtain the download link pointed to by the src attribute of the <img> or <video> element under the corresponding DOM element of that node.
   ii. Use the download_file Action to download the file from the URL in the previous step and save it to the file system. Direct clicking on the element to download is strictly prohibited. Record the returned file ID.
   b. If the target node is a webpage:
   i. First check whether the webpage can already be previewed. If no preview is displayed, you need to click the "Launch preview" button first.
   ii. After the preview is displayed, click the third button from the left in the bottom right corner of the webpage node "open in new tab", and use the Extract_structured_data Action to obtain the URL address of the newly opened page.
   c. If the target node is text/document:
   i. Click "Expand" on that node. A drawer will pop up on the right side of the canvas. Use the Extract_structured_data Action to extract all text content within that drawer.

## Operation 2 Invoke Model from Homepage

name: Invoke Model from Homepage
description: Can execute selection operations on behalf of the user after the user specifies a certain model, or can intelligently help the user select an appropriate model based on the user's query

---

### Instruction

1. First determine whether the toggle button "Agent Mode" in the upper right corner of the input box is in the On state. If not, skip directly to the second step. If yes, click the toggle button to turn off Agent mode.
2. Click the first selector at the bottom left corner of the input box to open the menu for switching model categories. Based on the goal and output type of the query, select the most appropriate category other than Agent Mode.
3. Use the `non_dom_vision_mouse_operator` Action to click the second selector at the bottom left corner of the input box to open the dropdown menu for switching specific models. If the user has specified which model to invoke, select directly from the right column of the pop-up dropdown menu; if the user has not specified, select according to the Available model category below.

### Notes

- This task operates on the canvas with complex DOM, it's best to use non_dom_vision_mouse_operator to execute the task.
- When selecting the target model, you must ensure it is exactly correct, for example, Gemini 2.5 pro and Gemini 2.5 Flash are two different models and cannot be confused!

### How to Select a Specific Model in the Pop-up Dropdown Menu

When the target model cannot be found, first execute the scroll_at Action to scroll and continue searching. If still not found, click to switch the Advanced-Basic Tab, then search again. If still not found, inform the user that the model is not currently supported or the current attachment format does not support invoking that model.

### Available Model or Tool Category

1. Regular (i.e., ordinary non-multimodal LLM model):

- Code engineering tasks: Claude Opus 4.1 (if this model is not found, select Gemini 2.5 pro)
- Other Regular tasks: For complex tasks requiring deep thinking and reasoning, use Gemini 2.5 pro; for simple tasks, use GPT 4.1 (if this model is not found, select Gemini 2.5 flash)

2. Online Search: Use Gemini 2.5 pro
3. Image/Video:

- Image generation tasks: Gemini 2.5 Flash Image
- Video generation tasks: First make a judgment according to the "Determine Image Source" rules below. If the source is "image", use Kling Video V1.6 | Image-to-video; if the source is "text", use Kling Video V1.6 | Text-to-video; if the source is "other_file", inform the user that video generation only accepts images as attachments; if the source is "group", inform the user that video generation does not accept node groups as context

4. Prompt Enhance: Claude Opus 4.1 (if this model is not found, switch to Regular Category and select Gemini 2.5 pro)
5. Comparison (i.e., simultaneously invoke multiple non-multimodal LLM models and compare results, suitable for non-multimodal tasks, but because the query is relatively complex and it is uncertain which regular model generates better results, comparison is needed, or when reference to multiple model generation results is needed) select simultaneously: Gemini 2.5 Pro, Claude Opus 4.1, GPT 4.1, GPT 5, Grok 4, Deepseek R1

### Determine Image Source

If it is a video generation task, you need to first determine the source of the image: 1. Check the file types uploaded in the input box (all files are stacked and displayed in the upper left corner of that node). If the uploaded files are all in image format, the source is "image"; if not all are in image format, the source is "other_file"; if there are no uploaded files, the source is "text"

## Operation 3 Invoke Model on Canvas

name: Invoke Model on Canvas
description: Can execute selection operations on behalf of the user after the user specifies a certain model, or can intelligently help the user select an appropriate model based on the user's query

---

### Instruction

1. Click the selector at the bottom left corner of the input box to open the menu for switching models. Based on the goal and output type of the query, select the most appropriate category in the left column other than Agent Mode.
2. Use the `non_dom_vision_mouse_operator` Action. If the user has specified which model to invoke, select directly from the right column of the pop-up dropdown menu; if the user has not specified, select according to the Available model category.

### Notes

- This task operates on the canvas with complex DOM, it's best to use non_dom_vision_mouse_operator to execute the task.
- When selecting the target model, you must ensure it is exactly correct, for example, Gemini 2.5 pro and Gemini 2.5 Flash are two different models and cannot be confused!

### How to Select a Specific Model in the Pop-up Dropdown Menu

When the target model cannot be found, first use non_dom_vision_mouse_operator to find the right column of the "Mode & Models" window (i.e., the model selection area below the Advanced|Basic Tabs), execute the scroll_at Action to scroll and continue searching. If still not found, click to switch the Advanced-Basic Tab, then search again. If still not found, inform the user that the model is not currently supported or the current attachment format does not support invoking that model.

### Available Model or Tool Category

1. Regular (i.e., ordinary non-multimodal LLM model):

- Code engineering tasks: Claude Opus 4.1 (if this model is not found, select Gemini 2.5 pro)
- Other Regular tasks: For complex tasks requiring deep thinking and reasoning, use Gemini 2.5 pro; for simple tasks, use GPT 4.1 (if this model is not found, select Gemini 2.5 flash)

2. Online Search: Use Gemini 2.5 pro
3. Image/Video:

- Image generation tasks: Gemini 2.5 Flash Image
- Video generation tasks: First make a judgment according to the "Determine Image Source" rules below. If the source is "image", use Kling Video V1.6 | Image-to-video; if the source is "text", use Kling Video V1.6 | Text-to-video; if the source is "other_file", inform the user that video generation only accepts images as attachments; if the source is "group", inform the user that video generation does not accept node groups as context

4. Prompt Enhance: Claude Opus 4.1 (if this model is not found, switch to Regular Category and select Gemini 2.5 pro)
5. Comparison (i.e., simultaneously invoke multiple non-multimodal LLM models and compare results, suitable for non-multimodal tasks, but because the query is relatively complex and it is uncertain which regular model generates better results, comparison is needed, or when reference to multiple model generation results is needed) select simultaneously: Gemini 2.5 Pro, Claude Opus 4.1, GPT 4.1, GPT 5, Grok 4, Deepseek R1

### Determine Image Source

If it is a video generation task, you need to first determine the source of the image: 1. Find the node in the canvas with "Typing..." displayed in the bottom right corner. 2. If there is only one such node, that node is the currently operating node; if there is more than one, compare the content of these nodes with the text content entered in the input box at the bottom center, and the one that matches exactly is the operating node. 3. Check the file types uploaded on that query node (all files are stacked and displayed in the upper left corner of that node). If the uploaded files are all in image format, the source is "image"; if not all are in image format, the source is "other_file"; if there are no uploaded files, first find the previous node connected by a dotted line above the center of that node. If the previous node is a node group surrounding multiple nodes, the source is "group"; if the previous node is a node consisting of a single image, the source is "image"; if the previous node is a pure text node, the source is "text"

## Operation 4 Invoke Agent Neo

name: Invoke Agent Neo
description: Invoke agent neo to complete complex tasks such as in-depth long-term research, building websites for brands, developing web games, etc.

---

### Instruction

First determine whether the "Agent Mode" in the upper right corner of the input box (if on the homepage) or lower left corner (if on the canvas) is in the On state. If yes, Agent Neo Mode has already been enabled and no other operations are needed. If not, click the selector at the bottom left corner of the input box to open the menu for switching models, and select the last item in the left column "Agent Mode"
