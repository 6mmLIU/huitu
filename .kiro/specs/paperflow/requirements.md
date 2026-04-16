# 需求文档

## 简介

PaperFlow 是一个面向学术论文的智能流程图生成平台。该平台解决研究者从"文字描述"到"论文级流程图"之间的工具断层问题，支持用户将自然语言描述一键转换为符合学术排版规范的流程图（SVG），并提供多格式导出能力。核心架构采用"LLM 生成结构 + 确定性引擎渲染"分离设计，通过 JSON AST 中间表示（IR）连接语义解析与图形渲染。

本文档聚焦 MVP 范围：自然语言→流程图生成、学术默认模板、SVG/PNG 导出、免登录使用、基础样式微调。

## 术语表

- **PaperFlow_System**: PaperFlow 平台整体系统，包含前端应用、后端服务及所有子模块
- **NL_Parser**: 自然语言解析服务，负责调用 LLM API 将用户输入的自然语言文本解析为结构化的 IR
- **IR**: 中间表示（Intermediate Representation），JSON AST 格式，描述流程图的节点、边、层级关系
- **Render_Engine**: 渲染引擎服务，负责将 IR 转换为 SVG 图形输出，使用 Dagre/ELK 布局算法
- **Style_Template**: 样式模板，定义流程图的视觉规范（字体、边框、填充、箭头等）
- **academic-default**: 默认学术样式模板，遵循通用学术论文排版规范
- **Editor_Panel**: 前端编辑器面板，包含文本输入区域（Monaco Editor）和样式微调控件
- **Export_Service**: 导出服务，负责将渲染结果转换为 SVG、PNG 等目标格式
- **LocalStorage_Manager**: 本地存储管理器，负责在浏览器 LocalStorage 中管理用户会话数据
- **Flow_Canvas**: 流程图画布组件，负责展示渲染后的 SVG 流程图

## 需求

### 需求 1：自然语言输入与语义解析

**用户故事：** 作为一名学术论文写作者，我希望将论文中的文字描述粘贴到输入框中，系统自动解析语义结构并生成对应的流程图，从而省去手动绘图的时间。

#### 验收标准

1. WHEN 用户在 Editor_Panel 中粘贴或输入自然语言文本并触发生成操作, THE NL_Parser SHALL 将该文本发送至 LLM API 并返回符合 IR 规范的 JSON AST 结构
2. THE NL_Parser SHALL 正确识别文本中的顺序关系、条件分支关系、并列关系和层级包含关系，并在 IR 中以对应的节点类型和边类型表达
3. WHEN NL_Parser 返回 IR 结果, THE Render_Engine SHALL 使用 Dagre/ELK 布局算法生成布局合理、无节点重叠的流程图
4. THE Render_Engine SHALL 确保生成的流程图中所有文字标注与用户原始输入语义一致，不产生幻觉内容（即不添加用户未描述的节点或关系）
5. WHEN 用户输入为简单流程描述（节点数 ≤ 10）, THE PaperFlow_System SHALL 在 8 秒内完成从输入到流程图渲染展示的全过程
6. WHEN 用户输入为复杂流程描述（节点数 > 10）, THE PaperFlow_System SHALL 在 15 秒内完成从输入到流程图渲染展示的全过程

### 需求 2：中间表示（IR）规范

**用户故事：** 作为一名开发者，我希望系统使用标准化的中间表示格式连接语义解析与图形渲染，从而实现模块解耦和可扩展性。

#### 验收标准

1. THE IR SHALL 使用 JSON AST 格式描述流程图，包含节点列表（nodes）、边列表（edges）和层级分组信息（groups）
2. THE IR SHALL 为每个节点定义唯一标识符（id）、显示文本（label）、节点类型（type：process/decision/start/end/subprocess）和位置信息（position）
3. THE IR SHALL 为每条边定义源节点标识符（source）、目标节点标识符（target）、连线标签（label，可选）和连线类型（type：normal/conditional）
4. WHEN NL_Parser 生成 IR, THE NL_Parser SHALL 输出符合预定义 JSON Schema 的合法 IR 文档
5. FOR ALL 合法的 IR 文档，将 IR 序列化为 JSON 字符串再反序列化后 SHALL 产生与原始 IR 等价的对象（往返一致性）


### 需求 3：学术论文级样式模板

**用户故事：** 作为一名学术论文写作者，我希望生成的流程图自动符合学术论文排版规范，从而无需手动调整样式即可直接用于论文。

#### 验收标准

1. THE Style_Template（academic-default）SHALL 使用纯色实线边框、白色或浅灰色填充，禁止使用渐变或阴影效果
2. THE Style_Template（academic-default）SHALL 使用宋体（中文）和 Times New Roman（英文）作为默认字体
3. THE Style_Template（academic-default）SHALL 使用实线箭头和直角折线作为默认连线样式
4. THE Style_Template（academic-default）SHALL 使用单色体系（黑、白、灰）作为默认配色方案
5. WHEN Render_Engine 应用 academic-default 模板渲染流程图, THE Render_Engine SHALL 生成视觉上符合上述学术排版规范的 SVG 输出

### 需求 4：基础样式微调

**用户故事：** 作为一名学术论文写作者，我希望在默认模板基础上微调字体、字号、边框粗细和填充色，从而满足不同期刊或学校的排版要求。

#### 验收标准

1. THE Editor_Panel SHALL 提供样式微调面板，包含字体切换、字号调整、边框粗细调整和填充色替换控件
2. WHEN 用户在样式微调面板中修改任一样式属性, THE Flow_Canvas SHALL 在 500 毫秒内实时更新流程图预览以反映修改结果
3. THE Editor_Panel SHALL 将用户的样式微调配置与当前 IR 关联存储，确保导出时应用用户自定义样式
4. WHILE 用户正在进行样式微调, THE PaperFlow_System SHALL 保留原始生成的 IR 不变，仅修改样式层属性

### 需求 5：SVG 导出

**用户故事：** 作为一名学术论文写作者，我希望将生成的流程图导出为 SVG 格式，从而在 Word、LaTeX 或 WPS 中直接使用。

#### 验收标准

1. WHEN 用户触发 SVG 导出操作, THE Export_Service SHALL 生成包含内嵌字体信息的 SVG 文件
2. THE Export_Service SHALL 确保导出的 SVG 文件大小不超过 500KB
3. WHEN 用户触发 SVG 导出操作, THE Export_Service SHALL 在 1 秒内完成导出并触发浏览器下载
4. THE Export_Service SHALL 确保导出的 SVG 文件在 Chrome 90+、Firefox 90+、Safari 15+ 和 Edge 90+ 中渲染结果一致

### 需求 6：PNG 导出

**用户故事：** 作为一名学术论文写作者，我希望将流程图导出为高分辨率 PNG 图片，从而在不支持矢量图的场景中使用。

#### 验收标准

1. WHEN 用户选择 PNG 导出, THE Export_Service SHALL 提供 300dpi 和 600dpi 两种分辨率选项
2. WHEN 用户确认 PNG 导出操作, THE Export_Service SHALL 将当前 SVG 渲染结果按所选分辨率转换为 PNG 文件并触发浏览器下载
3. THE Export_Service SHALL 确保 PNG 导出的图像内容与 Flow_Canvas 上显示的流程图视觉一致

### 需求 7：免登录使用与本地存储

**用户故事：** 作为一名首次访问的用户，我希望无需注册或登录即可使用核心功能，从而实现零门槛体验。

#### 验收标准

1. THE PaperFlow_System SHALL 允许用户在未登录状态下使用自然语言输入、流程图生成、样式微调和导出功能
2. WHEN 用户生成流程图后, THE LocalStorage_Manager SHALL 将当前会话的 IR 和样式配置自动保存至浏览器 LocalStorage
3. WHEN 用户重新访问 PaperFlow_System, THE LocalStorage_Manager SHALL 自动恢复上次会话的 IR 和样式配置
4. THE PaperFlow_System SHALL 不对用户输入内容进行持久化服务端存储，除非用户主动触发保存操作
5. THE PaperFlow_System SHALL 不将用户输入内容用于模型训练


### 需求 8：支持的图表类型

**用户故事：** 作为一名学术论文写作者，我希望系统能生成多种常见的学术图表类型，从而覆盖论文中的主要图示需求。

#### 验收标准

1. THE NL_Parser SHALL 支持解析并生成以下 P0 图表类型：顺序流程图、条件分支流程图、系统架构图（分层）和功能模块图（树形）
2. WHEN 用户输入包含条件分支描述, THE NL_Parser SHALL 在 IR 中生成 decision 类型节点和对应的 conditional 类型边
3. WHEN 用户输入包含层级结构描述, THE NL_Parser SHALL 在 IR 中生成 group 分组信息以表达层级包含关系
4. THE Render_Engine SHALL 为每种 P0 图表类型提供合理的默认布局策略（顺序图使用自上而下布局，树形图使用层级布局）

### 需求 9：用户交互流程

**用户故事：** 作为一名学术论文写作者，我希望从粘贴文字到下载流程图的操作不超过 3 步，从而实现零学习成本的使用体验。

#### 验收标准

1. THE PaperFlow_System SHALL 提供"粘贴文本 → 生成流程图 → 下载"三步核心操作流程
2. WHEN 用户首次访问 PaperFlow_System, THE Editor_Panel SHALL 在首屏展示文本输入区域和生成按钮，无需额外导航
3. WHEN 用户完成流程图生成, THE Flow_Canvas SHALL 在流程图旁显示导出按钮，用户可一键触发下载
4. THE PaperFlow_System SHALL 在 2 秒内完成首屏加载并展示可交互的编辑界面

### 需求 10：中英文双语界面

**用户故事：** 作为一名学术论文写作者，我希望界面支持中英文切换，从而满足不同语言环境下的使用需求。

#### 验收标准

1. THE PaperFlow_System SHALL 提供中文和英文两种界面语言选项
2. WHEN 用户切换界面语言, THE PaperFlow_System SHALL 在 500 毫秒内完成所有界面文本的语言切换，不影响当前流程图内容
3. THE NL_Parser SHALL 支持中文和英文两种自然语言输入，并正确解析两种语言的语义结构

### 需求 11：错误处理

**用户故事：** 作为一名学术论文写作者，我希望在输入无法解析或系统出错时获得清晰的错误提示，从而知道如何调整输入。

#### 验收标准

1. IF 用户输入的文本无法被 NL_Parser 解析为有效的流程结构, THEN THE PaperFlow_System SHALL 向用户显示描述性错误信息，说明解析失败的原因并提供输入建议
2. IF LLM API 调用超时或返回错误, THEN THE PaperFlow_System SHALL 向用户显示网络错误提示并提供重试按钮
3. IF NL_Parser 返回的 IR 不符合 JSON Schema 规范, THEN THE PaperFlow_System SHALL 自动重试一次解析，若仍失败则向用户显示错误提示
4. IF 导出过程中发生错误, THEN THE Export_Service SHALL 向用户显示导出失败提示并说明可能的原因

### 需求 12：API 安全与防滥用

**用户故事：** 作为平台运营者，我希望 API 调用具备鉴权和限流机制，从而防止资源滥用并保障服务稳定性。

#### 验收标准

1. THE PaperFlow_System SHALL 对所有后端 API 调用实施鉴权机制，拒绝未授权的请求
2. WHEN 未授权请求到达后端 API, THE PaperFlow_System SHALL 返回 HTTP 401 状态码
3. THE PaperFlow_System SHALL 对每个客户端实施请求频率限制，防止单一客户端过度消耗资源
4. WHEN 客户端请求频率超过限制阈值, THE PaperFlow_System SHALL 返回 HTTP 429 状态码并在响应头中包含重试等待时间

### 需求 13：浏览器兼容性

**用户故事：** 作为一名学术论文写作者，我希望在主流浏览器中获得一致的使用体验，从而不受浏览器选择的限制。

#### 验收标准

1. THE PaperFlow_System SHALL 在 Chrome 90+、Firefox 90+、Safari 15+ 和 Edge 90+ 中提供一致的功能和视觉表现
2. THE Flow_Canvas SHALL 在上述所有支持的浏览器中正确渲染 SVG 流程图，无布局偏移或字体缺失
3. IF 用户使用不支持的浏览器版本访问, THEN THE PaperFlow_System SHALL 显示浏览器升级提示信息
