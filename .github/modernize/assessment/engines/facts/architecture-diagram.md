# Architecture Diagram

基于 [PRD V0.3.1](../../../../../docs/archive/酒店收入增长诊断小程序_PRD_V0.3.1.md) 的拟议架构。当前工作区尚无应用源代码，以下为待评审的设计，不表示已经实现或部署。

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph Client1["接入层"]
        Owner1["业主小程序"]
        Advisor1["顾问工作台"]
        Admin1["规则管理后台"]
    end
    subgraph App1["业务服务层 - 模块化单体"]
        Api1["业务接口"]
        Auth1["身份授权与审计"]
        Core1["诊断与经营服务"]
        Review1["专家审核与交付"]
        Task1["持久化任务"]
    end
    subgraph Data1["数据与存储层"]
        Db1[("关系数据库")]
        File1[("私有文件存储")]
        Rule1["已批准规则版本"]
    end
    subgraph Ext1["外部能力 - 待确认"]
        Wx1["微信登录"]
        Ocr1["识别服务"]
    end
    Owner1 -->|"业务请求"| Api1
    Advisor1 -->|"顾问操作"| Api1
    Admin1 -->|"规则管理"| Api1
    Api1 -->|"检查授权"| Auth1
    Auth1 -->|"授权后访问"| Core1
    Auth1 -->|"授权后审核"| Review1
    Core1 -->|"读取及保存"| Db1
    Review1 -->|"保存报告版本"| Db1
    Core1 -->|"使用已发布规则"| Rule1
    Rule1 -->|"持久化"| Db1
    Core1 -->|"提交处理任务"| Task1
    Task1 -->|"存取私有文件"| File1
    Task1 -.->|"审批后识别"| Ocr1
    Api1 -.->|"登录验证"| Wx1
```

### Technology Stack Summary

| 层次 | 建议技术 | 版本 | 目的 |
|---|---|---|---|
| 业主端 | 微信原生小程序与 TypeScript | 待确认 | 移动端录入、核对和查看报告 |
| 顾问及管理端 | Web，候选 Vue 3 与 TypeScript | 待确认 | 多酒店、审核、交付和规则管理 |
| 业务服务 | Node.js LTS 与 NestJS，模块化单体 | 待确认 | 鉴权、诊断、报告及跟进 |
| 业务数据 | MySQL 或 PostgreSQL，二选一 | 待确认 | 结构化事实、授权、版本与审计 |
| 文件与任务 | 私有对象存储及持久化任务 | 待确认 | 截图、报告和异步识别导出 |
| 识别 | 经审批的 OCR 或结构化提取 | 待确认 | 辅助提取字段；不直接作诊断决定 |

### Data Storage & External Services

关系数据库与私有对象存储分别保存结构化数据和文件；规则、确认数据及报告建立版本关联。微信登录和识别服务均为待确认的接入方案；第三方识别须先通过隐私、安全及用户授权审批，未获批准时保留人工录入。

### Key Architectural Decisions

- 先使用模块化单体与持久化任务，避免在一期预设微服务、消息队列或缓存。
- 数据确认、已发布规则、顾问审核和报告交付分离；模型不决定价格或绕过门禁。
- 分诊授权与酒店授权分别校验；截图和报告始终私有，访问与删除遵循已批准策略。

## Component Relationships

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    subgraph Presentation2["展示层"]
        cOwner["业主界面"]
        cAdvisor["顾问界面"]
    end
    subgraph Business2["业务逻辑"]
        cIntake["首诊分流"]
        cHotel["酒店与授权"]
        cInputs["资料确认"]
        cOptional["费用与新媒体"]
        cMetrics["指标与价格诊断"]
        cScenario["渠道与情景"]
        cRules["规则版本"]
        cReport["报告草稿"]
        cReview["审核与交付"]
        cExperiment["试验"]
        cFollow["行动跟进"]
    end
    subgraph Access2["数据访问"]
        cFacts["经营事实"]
        cSnapshots["报告快照"]
    end
    subgraph Infra2["横切能力"]
        cAuth["身份授权"]
        cAudit["操作审计"]
    end
    cOwner -->|"填写资料"| cIntake
    cAdvisor -->|"人工评估"| cIntake
    cIntake -->|"适用且已授权"| cHotel
    cHotel -->|"登记资料"| cInputs
    cInputs -->|"确认后计算"| cMetrics
    cInputs -->|"可选事实"| cOptional
    cMetrics -->|"提供基线"| cScenario
    cRules -->|"约束诊断"| cMetrics
    cRules -->|"约束情景"| cScenario
    cMetrics -->|"输出依据"| cReport
    cScenario -->|"输出情景"| cReport
    cOptional -->|"按授权引用"| cReport
    cReport -->|"提交审核"| cReview
    cReview -->|"审核试验计划"| cExperiment
    cReview -->|"审核行动建议"| cFollow
    cFollow -.->|"引用试验状态"| cExperiment
    cInputs -->|"保存确认事实"| cFacts
    cReport -->|"保存版本"| cSnapshots
    cAuth -.->|"校验访问"| cIntake
    cAuth -.->|"校验访问"| cHotel
    cAuth -.->|"校验访问"| cReview
    cAudit -.->|"记录操作"| cReview
```

### Component Inventory

| 组件 | 层次 | 类型 | 职责 |
|---|---|---|---|
| 业主界面、顾问界面 | 展示层 | 客户端 | 收集资料、查看进度及授权内容 |
| 首诊分流、酒店与授权 | 业务逻辑 | 服务模块 | 区分项目范围，并分别校验分诊和酒店授权 |
| 资料确认、费用与新媒体 | 业务逻辑 | 服务模块 | 记录来源、期间、确认状态和可选事实 |
| 指标与价格诊断、渠道与情景 | 业务逻辑 | 确定性引擎 | 按已确认数据和已批准规则计算，保留假设 |
| 规则版本 | 业务逻辑 | 配置模块 | 管理审批发布及版本，不向客户端下发规则库 |
| 报告草稿、审核与交付 | 业务逻辑 | 服务模块 | 生成快照，经授权审核后交付 |
| 试验、行动跟进 | 业务逻辑 | 服务模块 | 保存计划、人工执行与结果，试验状态使用单一来源 |
| 经营事实、报告快照 | 数据访问 | 存储边界 | 持久化经过确认的数据和历史版本 |
| 身份授权、操作审计 | 横切能力 | 安全模块 | 最小权限访问和必要操作留痕 |
