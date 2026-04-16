# 实施计划：PaperFlow 智能流程图生成平台

## 概述

基于"LLM 生成结构 + 确定性引擎渲染"的分离架构，按模块逐步实现 PaperFlow MVP。实施顺序为：核心数据模型 → 后端服务 → 前端渲染引擎 → 前端 UI 组件 → 导出服务 → 集成联调。使用 TypeScript 作为前后端统一语言，fast-check 进行属性测试。

## 任务

- [x] 1. 项目初始化与核心数据模型
  - [x] 1.1 初始化 Next.js 项目结构与基础配置
    - 创建 Next.js SPA 项目，配置 TypeScript、ESLint、Prettier
    - 安装核心依赖：monaco-editor、dagre、elkjs、next-intl、fast-check、ajv
    - 创建目录结构：`src/types/`、`src/services/`、`src/components/`、`src/lib/`、`src/i18n/`
    - _需求：9.4_

  - [x] 1.2 定义 IR、StyleConfig、SessionData 核心类型与 JSON Schema
    - 在 `src/types/ir.ts` 中定义 IR、IRNode、IREdge、IRGroup、IRMetadata 接口
    - 在 `src/types/style.ts` 中定义 StyleConfig 接口及 academic-default 默认值
    - 在 `src/types/session.ts` 中定义 SessionData 接口
    - 在 `src/lib/ir-schema.json` 中创建 IR JSON Schema 校验文件
    - 在 `src/lib/ir-validator.ts` 中使用 ajv 实现 IR Schema 校验函数
    - _需求：2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 编写 IR 序列化往返一致性属性测试
    - **属性 1：IR 序列化往返一致性**
    - 使用 fast-check 生成随机合法 IR 文档，验证 JSON.stringify → JSON.parse 后与原始 IR 深度相等
    - **验证需求：2.5**

  - [x] 1.4 编写 IR 结构完整性属性测试
    - **属性 2：IR 结构完整性**
    - 使用 fast-check 验证：(a) 节点 ID 唯一；(b) 边的 source/target 引用有效；(c) 分组 children 引用有效
    - **验证需求：2.1, 2.2, 2.3**

  - [x] 1.5 编写 IR Schema 校验一致性属性测试
    - **属性 3：IR Schema 校验一致性**
    - 使用 fast-check 生成随机 IR，验证通过 ajv Schema 校验器的行为正确
    - **验证需求：1.1, 2.4**

  - [x] 1.6 编写条件分支节点必有条件边属性测试
    - **属性 11：条件分支节点必有条件边**
    - 使用 fast-check 生成含 decision 节点的 IR，验证每个 decision 节点至少有一条 conditional 出边
    - **验证需求：8.2**

  - [x] 1.7 编写分组子元素引用有效性属性测试
    - **属性 12：分组子元素引用有效性**
    - 使用 fast-check 生成含 group 的 IR，验证 children 中每个 ID 对应存在的节点或子分组
    - **验证需求：8.3**

- [x] 2. 检查点 - 核心数据模型验证
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 3. 后端 API Gateway 与鉴权限流
  - [x] 3.1 实现 API Gateway 鉴权中间件
    - 创建 `src/server/middleware/auth.ts`，实现 API Key / Token 验证逻辑
    - 对 `POST /api/parse` 端点实施鉴权，未授权请求返回 HTTP 401
    - `GET /api/health` 端点不需要鉴权
    - _需求：12.1, 12.2_

  - [x] 3.2 实现请求频率限制中间件
    - 创建 `src/server/middleware/rate-limiter.ts`，实现令牌桶算法
    - 按客户端 IP 限制请求频率（10 次/分钟）
    - 超频请求返回 HTTP 429，响应头包含 Retry-After 字段
    - _需求：12.3, 12.4_

  - [x] 3.3 编写未授权请求返回 401 属性测试
    - **属性 14：未授权请求返回 401**
    - 使用 fast-check 随机生成不含/含无效凭证的请求，验证返回 HTTP 401
    - **验证需求：12.1, 12.2**

  - [x] 3.4 编写超频请求返回 429 属性测试
    - **属性 15：超频请求返回 429**
    - 模拟超频请求序列，验证返回 HTTP 429 且响应头包含 Retry-After
    - **验证需求：12.3, 12.4**

- [x] 4. NL_Parser 自然语言解析服务
  - [x] 4.1 实现 NL_Parser 服务核心逻辑
    - 创建 `src/server/services/nl-parser.ts`，封装 LLM API 调用
    - 实现 Prompt 工程模板，支持四种图表类型（sequential、conditional、architecture、tree）
    - 实现 IR Schema 校验，校验失败自动重试一次
    - 支持中文和英文两种自然语言输入
    - _需求：1.1, 1.2, 8.1, 8.2, 8.3, 10.3_

  - [x] 4.2 实现 POST /api/parse 端点
    - 创建 `src/app/api/parse/route.ts`（Next.js Route Handler）
    - 接收 ParseRequest（text + language），返回 ParseResponse（IR 或错误信息）
    - 实现错误处理：解析失败返回描述性错误信息和输入建议，LLM 超时/错误返回对应错误码
    - _需求：1.1, 11.1, 11.2, 11.3_

  - [x] 4.3 编写解析失败返回错误信息属性测试
    - **属性 16：解析失败返回错误信息**
    - 使用 fast-check 随机生成无效/无意义输入文本，验证返回包含非空错误消息和输入建议的错误响应
    - **验证需求：11.1**

  - [x] 4.4 编写 NL_Parser 单元测试
    - 测试各图表类型的具体输入/输出示例
    - 测试中英文双语解析示例
    - 测试 LLM 超时/错误的重试和提示逻辑
    - _需求：1.2, 8.1, 10.3, 11.2, 11.3_

- [x] 5. 检查点 - 后端服务验证
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 6. Render_Engine 渲染引擎
  - [x] 6.1 实现 Render_Engine 布局计算模块
    - 创建 `src/lib/render-engine.ts`，实现 `render(options: RenderOptions): RenderResult` 函数
    - 集成 Dagre 布局算法（默认），支持 ELK 布局（复杂图）
    - 根据 chartType 选择布局策略：sequential/conditional 使用自上而下布局，tree 使用层级布局，architecture 使用分层布局
    - 确保布局后节点无重叠
    - _需求：1.3, 8.4_

  - [x] 6.2 实现 SVG 生成与学术模板应用
    - 在 `src/lib/svg-generator.ts` 中实现 IR → SVG DOM 转换
    - 实现 academic-default 模板：纯色实线边框、白色/浅灰填充、无渐变无阴影
    - 使用宋体（中文）+ Times New Roman（英文）默认字体
    - 使用实线箭头和直角折线连线样式
    - 确保 SVG 中文字标签与 IR 中节点/边 label 完全一致
    - _需求：1.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.3 编写布局无重叠属性测试
    - **属性 4：布局无重叠**
    - 使用 fast-check 随机生成不同规模的 IR（1-30 节点），验证布局后任意两个节点边界框不重叠
    - **验证需求：1.3**

  - [x] 6.4 编写渲染标签保真属性测试
    - **属性 5：渲染标签保真**
    - 使用 fast-check 随机生成含各种 Unicode 字符标签的 IR，验证 SVG 中文字标签集合与 IR 中 label 集合完全一致
    - **验证需求：1.4**

  - [x] 6.5 编写学术模板无渐变无阴影属性测试
    - **属性 6：学术模板无渐变无阴影**
    - 使用 fast-check 随机生成 IR 并用 academic-default 渲染，验证 SVG 中不含 linearGradient、radialGradient、filter 元素
    - **验证需求：3.1**

  - [x] 6.6 编写图表类型决定布局策略属性测试
    - **属性 13：图表类型决定布局策略**
    - 使用 fast-check 随机生成不同 chartType 的 IR，验证 Render_Engine 选择对应的布局策略
    - **验证需求：8.4**

- [x] 7. 检查点 - 渲染引擎验证
  - 确保所有测试通过，如有疑问请向用户确认。


- [x] 8. 前端 UI 组件
  - [x] 8.1 实现 Editor_Panel 编辑器面板组件
    - 创建 `src/components/EditorPanel.tsx`，集成 Monaco Editor 作为文本输入区域
    - 实现"生成"按钮，触发 `onGenerate(text)` 回调
    - 首屏展示文本输入区域和生成按钮，无需额外导航
    - _需求：1.1, 9.2_

  - [x] 8.2 实现 Style_Panel 样式微调面板组件
    - 创建 `src/components/StylePanel.tsx`，包含字体切换、字号调整、边框粗细调整、填充色替换控件
    - 样式变更触发 `onStyleChange(config)` 回调
    - 将样式微调配置与当前 IR 关联存储
    - _需求：4.1, 4.3_

  - [x] 8.3 实现 Flow_Canvas 流程图画布组件
    - 创建 `src/components/FlowCanvas.tsx`，作为 SVG 容器展示渲染后的流程图
    - 支持缩放和平移交互
    - 接收 IR 和 StyleConfig，调用 Render_Engine 渲染
    - 样式变更后 500ms 内实时更新预览
    - 在流程图旁显示导出按钮
    - _需求：4.2, 9.3_

  - [x] 8.4 编写样式变更不影响 IR 属性测试
    - **属性 7：样式变更不影响 IR**
    - 使用 fast-check 随机生成 IR + 随机样式变更序列，验证操作后 IR 与操作前深度相等
    - **验证需求：4.4, 10.2**

  - [x] 8.5 编写前端组件单元测试
    - 测试 Editor_Panel 首屏包含输入区域和生成按钮
    - 测试 Style_Panel 包含所有必需控件
    - 测试 Flow_Canvas 渲染完成回调
    - 测试免登录状态下所有功能可用
    - _需求：4.1, 7.1, 9.2, 9.3_

- [x] 9. 国际化（i18n）中英文双语支持
  - [x] 9.1 配置 next-intl 国际化框架
    - 在 `src/i18n/` 下创建 `zh.json` 和 `en.json` 语言包
    - 配置 next-intl provider，支持中英文切换
    - 确保所有界面文本使用 i18n key，语言切换 500ms 内完成
    - 语言切换不影响当前流程图内容
    - _需求：10.1, 10.2_

- [x] 10. LocalStorage_Manager 本地存储管理
  - [x] 10.1 实现 LocalStorage_Manager 服务
    - 创建 `src/lib/local-storage-manager.ts`，实现 saveSession、loadSession、clearSession 函数
    - 流程图生成后自动保存 IR 和样式配置至 LocalStorage
    - 用户重新访问时自动恢复上次会话
    - 包含数据格式版本字段，支持未来迁移
    - 不进行服务端持久化存储
    - _需求：7.2, 7.3, 7.4, 7.5_

  - [x] 10.2 编写会话持久化往返一致性属性测试
    - **属性 8：会话持久化往返一致性**
    - 使用 fast-check 随机生成 SessionData，验证 saveSession → loadSession 后数据深度相等
    - **验证需求：7.2, 7.3**

- [x] 11. Export_Service 导出服务
  - [x] 11.1 实现 SVG 导出功能
    - 创建 `src/lib/export-service.ts`，实现 `exportFlowchart(options: ExportOptions): Promise<Blob>` 函数
    - SVG 导出包含内嵌字体信息（@font-face 声明）
    - 确保 SVG 文件大小不超过 500KB
    - 1 秒内完成导出并触发浏览器下载
    - _需求：5.1, 5.2, 5.3, 5.4_

  - [x] 11.2 实现 PNG 导出功能
    - 在 `src/lib/export-service.ts` 中扩展 PNG 导出逻辑
    - 使用 Canvas API 将 SVG 转换为 PNG
    - 支持 300dpi 和 600dpi 两种分辨率选项
    - PNG 图像内容与 Flow_Canvas 显示一致
    - _需求：6.1, 6.2, 6.3_

  - [x] 11.3 实现导出错误处理
    - 导出过程中发生错误时显示导出失败提示并说明可能原因
    - _需求：11.4_

  - [x] 11.4 编写 SVG 导出包含内嵌字体属性测试
    - **属性 9：SVG 导出包含内嵌字体**
    - 使用 fast-check 随机生成合法 IR，导出 SVG 后验证包含 @font-face 声明或内嵌字体数据
    - **验证需求：5.1**

  - [x] 11.5 编写 PNG 导出尺寸与 DPI 成比例属性测试
    - **属性 10：PNG 导出尺寸与 DPI 成比例**
    - 使用 fast-check 随机生成 SVG 尺寸 + 随机 DPI（300/600），验证 PNG 像素尺寸与逻辑尺寸和 DPI 成正比
    - **验证需求：6.2**

- [x] 12. 检查点 - 前端组件与导出服务验证
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 13. 错误处理与浏览器兼容性
  - [x] 13.1 实现前端统一错误处理
    - 创建 `src/lib/error-handler.ts`，定义 ErrorResponse 接口和错误码常量
    - 在 Editor_Panel 中集成错误提示 UI：解析失败显示原因和输入建议，LLM 超时/错误显示重试按钮
    - Schema 校验失败自动重试一次，仍失败则显示错误提示
    - _需求：11.1, 11.2, 11.3, 11.4_

  - [x] 13.2 实现浏览器兼容性检测
    - 创建 `src/lib/browser-detect.ts`，检测浏览器版本
    - 不支持的浏览器版本（Chrome < 90、Firefox < 90、Safari < 15、Edge < 90）显示升级提示
    - _需求：13.1, 13.2, 13.3_

- [x] 14. 全流程集成与页面组装
  - [x] 14.1 组装主页面，串联完整数据流
    - 在 `src/app/page.tsx` 中组装 Editor_Panel、Style_Panel、Flow_Canvas、Export_Buttons
    - 实现完整数据流：用户输入 → API 调用 → IR 返回 → 渲染 → 展示
    - 实现"粘贴文本 → 生成流程图 → 下载"三步核心操作流程
    - 集成 LocalStorage_Manager 自动保存/恢复会话
    - 集成 i18n 语言切换
    - 集成浏览器兼容性检测
    - _需求：1.1, 7.2, 7.3, 9.1, 9.2, 9.3, 10.1_

  - [x] 14.2 编写集成测试
    - 测试完整数据流：输入 → 解析 → 渲染 → 导出
    - 测试会话恢复流程
    - 测试语言切换不影响流程图内容
    - 测试错误处理流程（解析失败、LLM 超时、导出失败）
    - _需求：1.1, 7.3, 10.2, 11.1, 11.2_

- [x] 15. 最终检查点 - 全部测试通过
  - 确保所有测试通过，如有疑问请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- 属性测试使用 fast-check 库，每个测试至少 100 次迭代
- 属性测试标注格式：**Feature: paperflow, Property {number}: {property_text}**
- 检查点任务确保增量验证，及时发现问题
