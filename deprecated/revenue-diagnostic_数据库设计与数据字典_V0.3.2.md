# revenue-diagnostic：数据库设计与数据字典

> **评审草案 V0.3.2｜不含建表 SQL**  
> 项目名称：`revenue-diagnostic`；业务定位为酒店收入增长诊断系统。配套 [PRD V0.3.2](./revenue-diagnostic_PRD_V0.3.2.md)及[需求追踪与验收矩阵 V0.3.2](./revenue-diagnostic_需求追踪与验收矩阵_V0.3.2.md)。在工作区完整 V0.3.1 基础上细化周期和渠道事实、快照、三方案、任务、授权与交付；新增范围、字段、规则和留存策略均须甲方、业务、研发及法务确认后才能冻结。本文件定义逻辑契约，不代表数据库已经实现，也不要求每个逻辑结构必须对应一张物理表。

## 1. 设计原则与通用约定

1. 一个顾问可服务多个已授权酒店，一个酒店可有多位授权业主及顾问、多次诊断和多个报告版本；不可用单一 `user_id` 假定一对一关系。
2. 底层数据须能追溯来源、字段级确认、期间、操作者与版本；识别值不等于已确认值，情景假设不等于实际值。
3. 无数据使用 `NULL` 和状态，不把未知、未采集、不适用、尚未核实视为 0。明确确认的 0 可参与允许零值的计算。
4. 数据库、原图、导出文件私有；服务端逐次检查用户、酒店、资源和操作授权。授予角色不自动授予所有酒店数据。
5. 已审核报告、输入快照和试验方案版本普通修改时不可覆盖；涉及法定删除、授权撤回后的适用处理或留存到期时按批准策略清理，包括受控备份，并如实记录未完成部分。
6. 金额示例用 `DECIMAL(18,2)` 元，比例用 `DECIMAL(9,6)` 的 0～1 小数，时间 `DATETIME` 按 UTC 存储并在界面按业务时区显示，日期用 `DATE`；业务时区、币种和精度需评审。
7. 表格中的“必填”是创建该实体或形成有效事实的要求，不要求资料不全时禁止保存诊断草稿。
8. 表名和类型为建议设计，不预设具体云厂商。采用外键或等价约束；跨酒店资源必须同时核对所属酒店及有效授权。
9. 首诊可暂不关联酒店，其访问授权独立于酒店授权；关联酒店后不得自动扩大顾问的访问范围。
10. 费用和新媒体字段为可选资料，不是原有数据等级的新增必填项；未经确认的资料、阶段性目标和已实现事实分别保存。
11. `diagnosis.input_revision` 仅在所属诊断内有意义；历史报告还必须绑定可复核的快照及所选事实版本，不能仅凭数字修订号跨诊断关联。
12. 事件日期、业务日期、目标人群和归因窗口按指标保存；不同日期或订单状态不能因同一天或同一渠道而强行合并。预算、假设、实际支出与实际结果分开。

**通用审计字段**：各业务表建议包含 `id`（UUID，必填）、`created_at`、`created_by`、`updated_at`、`updated_by`、`version`；按策略使用删除状态与删除时间。并发修改以版本检查，冲突时不静默覆盖。

## 2. 实体关系

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    UserE["用户"]
    HotelE["酒店"]
    GrantE["酒店授权"]
    IntakeE["首诊分流"]
    ContactE["联系人"]
    ConsentE["用途同意"]
    AuthorityE["经营行动权限"]
    DiagnosisE["诊断"]
    SourceE["来源文件"]
    EvidenceE["字段证据"]
    DailyE["酒店逐日事实"]
    PeriodE["酒店周期事实"]
    ChannelE["渠道逐日事实"]
    ExpenseE["经营费用"]
    SocialE["新媒体统计"]
    CommissionE["佣金政策"]
    CompetitorE["竞品"]
    ObservationE["竞品观察"]
    ScenarioE["经营情景"]
    SnapshotE["输入与计算快照"]
    TaskE["异步任务"]
    ReportE["报告版本"]
    ReviewE["报告审核"]
    DeliveryE["报告交付"]
    ExperimentE["试验"]
    ResultE["试验结果"]
    FollowE["顾问跟进"]
    UserE -->|"一人可有多个授权"| GrantE
    UserE -->|"一人可创建多个分诊"| IntakeE
    UserE -->|"一人可有多个用途同意"| ConsentE
    HotelE -->|"一店可有多个授权"| GrantE
    HotelE -.->|"一店可关联多个分诊"| IntakeE
    HotelE -->|"一店可有多个联系人"| ContactE
    HotelE -->|"一店可有多个诊断"| DiagnosisE
    HotelE -->|"一店可有多个逐日事实"| DailyE
    HotelE -->|"一店可有多个周期事实"| PeriodE
    HotelE -->|"一店可有多个行动权限"| AuthorityE
    HotelE -->|"一店可有多个渠道事实"| ChannelE
    HotelE -->|"一店可有多个费用记录"| ExpenseE
    HotelE -->|"一店可有多个新媒体记录"| SocialE
    HotelE -->|"一店可有多个佣金政策"| CommissionE
    HotelE -->|"一店可有多次跟进"| FollowE
    DiagnosisE -->|"一项诊断可有多个文件"| SourceE
    DiagnosisE -->|"一项诊断可有多个字段证据"| EvidenceE
    DiagnosisE -->|"一项诊断可有多个竞品"| CompetitorE
    CompetitorE -->|"一项竞品可有多次观察"| ObservationE
    DiagnosisE -->|"一项诊断可有多个情景"| ScenarioE
    DiagnosisE -->|"一项诊断可有多个快照"| SnapshotE
    DiagnosisE -->|"一项诊断可有多个任务"| TaskE
    DiagnosisE -->|"一项诊断可有多个报告版本"| ReportE
    DiagnosisE -->|"一项诊断可有多个试验"| ExperimentE
    ReportE -->|"一份报告可有多次审核"| ReviewE
    ReportE -->|"每版关联输入快照"| SnapshotE
    ReportE -->|"一份报告可有多次交付"| DeliveryE
    ExperimentE -->|"一项试验可有多个结果"| ResultE
```

规则版本与诊断/报告通过版本 ID 关联；截图/证据与下表中的事实、竞品和情景通过字段级证据映射关联。分诊可由创建人或明确授权的指定顾问访问，不能以其代替酒店授权；身份归属与业务授权分离，不以报告或文件 URL 代替鉴权。

## 3. 用户、酒店与访问授权

### 3.1 `user` 用户与 `hotel` 酒店

| 表.字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| user.login_provider | VARCHAR(32) | 是 | 登录提供方；微信接入须在服务端验证 |
| user.provider_subject | VARCHAR(128) | 是 | 提供方用户标识，和 provider 联合唯一；不默认采集手机号 |
| user.status | VARCHAR(16) | 是 | active/disabled；角色由独立权限配置分配 |
| hotel.name | VARCHAR(200) | 是 | 酒店名称，来源及确认状态须可追溯 |
| hotel.brand | VARCHAR(100) | 否 | 品牌名称；所属集团不默认推断 |
| hotel.city / business_area | VARCHAR(100) | 否 | 城市及商圈；未知显式标记 |
| hotel.room_count | INTEGER | 否 | 基础房量，正整数；随日期变化时以逐日可售为准 |
| hotel.diamond_level / diamond_platform | VARCHAR(16) / VARCHAR(32) | 否 | 当前已确认的平台钻级及所属平台；保留来源和确认时间，不能与目标钻级或其他星级混同 |
| hotel.price_authority / channel_authority | VARCHAR(24) | 是 | self/approval/none/unknown，保留概括性价格及渠道权限；不能据此自动推断加佣、投流或促销的分项权限 |
| hotel.business_timezone | VARCHAR(64) | 否 | 酒店经营日期使用的业务时区；未知时提示确认，不由上传时间猜测 |

`contact`：`hotel_id`、姓名或称呼、联系方式、用途、取得和使用授权、来源；仅收集必要字段，权限、加密与删除同酒店数据。不得把住客名单作为客户联系人。

### 3.2 `hotel_grant` 酒店授权

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| hotel_id / grantee_user_id | UUID | 是 | 授权的酒店及被授权用户 |
| role | VARCHAR(24) | 是 | owner/staff/consultant；全局管理员单独配置 |
| permissions | 受控集合 | 是 | 如资料读写、确认、审核、交付、授权管理；按最小权限 |
| status | VARCHAR(16) | 是 | pending/active/revoked/expired |
| granted_by / granted_at | UUID / DATETIME | 启用时是 | 有权授权的人及时间；授权依据受控存储 |
| expires_at / revoked_at | DATETIME | 否 | 到期或撤销后拒绝在线访问；记录操作人和原因 |

建议限制同一酒店、用户、角色的有效授权重复；跨酒店复制、审核和下载须分别检查目标资源权限。历史审计保留与撤权后的数据删除由法务确定。

### 3.3 `service_intake` 首诊分流

创建前须展示信息处理目的并取得必要同意；该记录可以暂不关联 `hotel`，不得要求完整经营数据或住客信息。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| creator_id / consent_ref | UUID / 关联 | 是 | 创建人及有效的同意版本和时间；不同意时不创建 |
| project_name / city | VARCHAR(200) / VARCHAR(100) | 是/否 | 项目或酒店称谓；城市可选，不默认要求联系人或手机号 |
| project_stage | VARCHAR(24) | 是 | operating/preparation/renovation/exit_planning/other/unknown；记录用户所述阶段 |
| operating_status | VARCHAR(24) | 是 | open/suspended/not_open/unknown；改造中也可能仍营业，不由阶段推断 |
| primary_objective | TEXT | 是 | 客户希望解决的主要问题；提示不要填写无关个人信息 |
| suitability_status | VARCHAR(24) | 是 | pending/eligible/out_of_scope；项目阶段已确认且符合在营、目标和其他已确认条件才可标 eligible |
| referral_status / referral_at | VARCHAR(24) / DATETIME | 是/否 | pending/recorded/closed；recorded 表示有权人员已实际记录转交，并保留操作者和时间，不等于自动通知或已联系 |
| hotel_id | UUID | 否 | 关联酒店前须校验关联操作权限；空值不代表公开分诊 |
| consultant_user_id / grant_status | UUID / VARCHAR(16) | 否/是 | 可指定被授权顾问，状态 none/pending/active/revoked；active 时须指定顾问，有有效授权才能读取该分诊 |
| grant_by / grant_at / grant_basis_ref | UUID / DATETIME / 关联 | 启用时是 | 记录有权主体、时间与授权依据；分诊授权与 `hotel_grant` 分开撤销 |

项目阶段已确认、仍在营业且目标为在营经营改善时，其他一期适用条件确认后可进入酒店授权与诊断。未开业、暂停营业、项目阶段或营业状态未知或目标超出范围时保留人工评估状态；不擅自创建在营诊断或代替顾问联系客户。

## 4. 诊断、来源和字段确认

### 4.1 `diagnosis`

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| hotel_id | UUID | 是 | 所属酒店，所有关联记录必须同属该酒店 |
| creator_id | UUID | 是 | 有权建档的业主或顾问 |
| period_start / period_end | DATE | 是 | 起止日均含；结束不得早于开始 |
| status | VARCHAR(24) | 是 | 诊断进度摘要，如 draft/review_data/ready/review_report；报告审核和按接收人的交付状态另存，不能由此推断送达 |
| data_level | VARCHAR(8) | 否 | L1/L2/L3；草稿可空，具体入级规则待批准 |
| input_revision | INTEGER | 是 | 仅在本诊断内递增；影响结果的确认事实、选用来源或情景假设变更时形成新修订。修订号须与诊断及快照一起使用 |
| rule_version_id | UUID | 否 | 产生规则判断时记录已发布版本 |
| current_step / progress_saved_at | VARCHAR(64) / DATETIME | 否 | 最近一次成功保存的向导步骤及时间；失败或版本冲突不能更新为成功 |

### 4.2 `source_file` 与 `evidence_value`

| 表.字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| source_file.diagnosis_id / hotel_id | UUID | 是 | 权限及归属；文件以私有对象键保存 |
| source_file.type | VARCHAR(32) | 是 | 本店后台、PMS、搜索列表、竞品详情等 |
| source_file.object_key / checksum | VARCHAR | 是 | 私有路径和校验值，不存公开长期链接 |
| source_file.captured_at | DATETIME | 否 | 截图时间；未知不得用上传时间冒充 |
| evidence_value.entity_type / entity_id / field_key | VARCHAR / UUID / VARCHAR | 是 | 指向具体业务实体和字段；须校验酒店归属 |
| evidence_value.source_type / source_file_id | VARCHAR / UUID | 是/否 | screenshot/manual/import；截图来源需关联文件和可见性 |
| evidence_value.recognized_value / confirmed_value | 类型化值 | 否 | 分别保留识别原值、修改后值；按字段类型校验 |
| evidence_value.verification_status | VARCHAR(20) | 是 | unverified/confirmed/unknown/not_applicable/rejected；未知和不适用均不能按确认零值处理 |
| evidence_value.confirmed_by / confirmed_at | UUID / DATETIME | 确认时是 | 确认人须有对应授权；顾问代确认权限另行明确 |
| evidence_value.correction_reason | TEXT | 否 | 用户或顾问的修正说明；不得覆盖原始识别值 |

正式计算只读取相关字段已确认且口径有效的版本。截图价格的入住日期和截图时间须在图中可见；图面缺失的人工陈述默认不用于正式价格对标。

## 5. 酒店逐日与渠道数据

### 5.1 `hotel_daily` 逐日经营事实

粒度：**酒店 × 经营日期 × 日期依据 × 事实版本**，同一口径的同一版本不得重复。经营日期是入住/房晚日期还是财务结算日期须明确，不能混用；事实版本独立于每个诊断的本地输入修订。

| 字段 | 类型 | 必填 | 单位/规则 |
|---|---|---|---|
| hotel_id / business_date | UUID / DATE | 是 | 日期归属和业务时区明确 |
| date_basis / currency | VARCHAR(32) / CHAR(3) | 是/收入时是 | 入住房晚日、结算日或其他有来源的依据；收入币种不得凭空默认 |
| available_room_nights | INTEGER | 否 | 间夜；实际可售优先，须大于 0 才计算出租率 |
| sold_room_nights | INTEGER | 否 | 间夜；0～可售房晚，超出需核对口径 |
| room_revenue | DECIMAL(18,2) | 否 | 元；需注明税费、退款、优惠和佣金扣除口径 |
| revenue_basis | VARCHAR(32) | 否 | before_discount/after_discount 等；基数未确认不得与渠道情景混算 |
| adr / occupancy | 派生值 | 否 | ADR=收入÷售出房晚，出租率=售出÷可售；另有来源报告的 ADR 时单独保存其来源，冲突需核对 |
| quality_status / fact_revision | VARCHAR / INTEGER | 是 | 事实版本及记录状态；字段确认状态通过证据关联，诊断选择具体版本并固化到快照 |

周期数据和日数据分开存储与展示；不得把周期总量填成每日事实。日汇总与周期总数不一致时提示核对，不自动覆盖或相加。周期结构见第 12 节。

### 5.2 `channel_daily` 逐日渠道表现

粒度建议为**酒店 × 渠道 × 统计日期或期间 × 指标/状态口径 × 人群与归因范围 × 事实版本**。一条记录中的多个指标只有在共享同一日期依据、人群和适用口径，或对每个指标分别保存这些依据时才可共存；不同依据须拆分或单独标注，不能强行合并。

| 字段 | 类型 | 必填 | 单位/规则 |
|---|---|---|---|
| hotel_id / channel_code / stat_date | UUID / VARCHAR(32) / DATE | 是 | 平台或渠道，日期和时间口径明确 |
| date_basis / metric_basis | VARCHAR / 受控结构 | 是 | 事件日、下单日、入住日、退款日、结算日或其他；每个指标保留事件定义、去重与来源 |
| order_status / population_scope | VARCHAR / 受控结构 | 适用时是 | 指标对应的下单、有效、取消、入住或退款集合，以及目标人群；集合关系未知时不推断 |
| impressions / clicks | BIGINT | 否 | 次；非负，不假设缺失值为 0 |
| orders / sold_room_nights | BIGINT / INTEGER | 否 | 订单数与间夜分别保存，不互换 |
| revenue_before_discount | DECIMAL(18,2) | 否 | 元；优惠前、扣佣前房费 |
| hotel_discount | DECIMAL(18,2) | 否 | 元；酒店承担且尚未从对应优惠前收入扣除的优惠；与已扣优惠收入不可重复相减 |
| revenue_after_discount | DECIMAL(18,2) | 否 | 元；相同口径下等于优惠前减酒店承担优惠，补贴、税和退款另行核实 |
| commission_settled / ad_spend | DECIMAL(18,2) | 否 | 元；同范围实际佣金和酒店承担广告及独立推广费，分别记录来源、期间与防重依据 |
| attributed_orders / attribution_window | INTEGER / VARCHAR(64) | 否 | 归因订单及窗口；不等于新增订单 |
| currency / status / fact_revision | CHAR(3) / VARCHAR(20) / INTEGER | 是 | 币种、草稿/确认/未知及事实版本；字段级证据仍需分别确认，版本不是诊断内修订号 |

曝光、点击和订单仅在渠道、期间、事件定义、人群、去重及归因窗口匹配时计算漏斗；同一天不自动表示同一人群，分母为 0 或缺失则不可计算。跨日转化须有可核验的人群关联及获批准窗口。

## 6. 佣金、促销与竞品

### 6.1 `commission_policy` 佣金政策

| 字段 | 类型 | 必填 | 单位/规则 |
|---|---|---|---|
| hotel_id / channel_code | UUID / VARCHAR(32) | 是 | 对应本店及平台 |
| base_rate / additional_rate | DECIMAL(9,6) | 否 | 比例 0～1；额外费率是否与基础费率相加由合同确认 |
| calculation_basis | VARCHAR(64) | 否 | 费率适用的房费、优惠前后和税费口径 |
| effective_start / effective_end | DATE | 否 | 适用有效期；缺失不擅自沿用 |
| effective_date_basis | VARCHAR(24) | 否 | booking_date/stay_date/settlement_date/other/unknown；对应合同的生效日期依据 |
| room_type / activity_scope | VARCHAR | 否 | 房型、活动或其他条件；重叠政策需明确优先级 |
| eligible_order_scope / affected_baseline | 受控结构 / 关联 | 否 | 已存在订单和新增订单的适用范围、受影响基数及来源；未知不能假定全部受影响 |
| additional_promotion_fee | DECIMAL(18,2) | 否 | 元；确认是否与广告或佣金重复 |
| actual_settlement_amount | DECIMAL(18,2) | 否 | 元；须关联结算周期及来源；优先于估算 |
| contract_source / verification_status | UUID / VARCHAR | 否/是 | 合同或证明文件引用及核实状态 |

### 6.2 `promotion`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| hotel_id / channel_code | UUID / VARCHAR | 是 | 酒店、渠道及适用日期 |
| starts_on / ends_on | DATE | 是 | 有效日期 |
| discount_type / discount_value | VARCHAR / DECIMAL | 否 | 固定金额或比例；单位明确，不得混用 |
| payer | VARCHAR(24) | 否 | hotel/platform/shared/unknown；分担金额或比例另列 |
| payer_split / revenue_basis | 受控结构 / VARCHAR | 否 | 酒店、平台及其他方各自承担金额或比例；注明收入是否已扣酒店承担的优惠 |
| eligible_scope | TEXT | 否 | 房型、订单及已存在订单是否受影响 |
| source / verification_status | 关联 / VARCHAR | 是 | 来源、核实状态；费用与收入避免重复计入 |

### 6.3 `competitor` 与 `competitor_observation`

竞品档案：`diagnosis_id`、酒店名称、位置/距离、档次、钻级、装修/开业年份、面积、评分、可比状态及依据。候选数量按 PRD 引导 3～5 家，真正可比的最低数量须业务确认。

观察记录粒度：竞品 × 入住日期 × 房型/条件 × 截图时间 × 来源。字段包括挂牌价、币种、餐食/取消/优惠条件、截图时间、近期出租情况；佣金、额外政策、投流、促销、曝光、点击、订单、间夜、成交 ADR 均可空并单独记录周期、计费口径和证据。无合法可靠来源标未知；不得推断竞品经营秘密。

## 7. 情景、试验、报告和交付

### 7.1 `scenario` 情景及财务计算

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| diagnosis_id / hotel_id | UUID | 是 | 数据及授权归属一致 |
| scenario_type | VARCHAR(20) | 是 | commission/advertising/promotion；涨价可单列其他行动 |
| period_start / period_end / channel_code | DATE / VARCHAR | 是 | 与基线同日期、渠道、房型及统计口径 |
| baseline_revision / calculation_snapshot_id | INTEGER / UUID | 是/计算时是 | 前者仅属于该诊断；计算时绑定实际选择的事实、假设及规则快照，不单凭修订号查找事实 |
| room_scope / capacity | 受控结构 / INTEGER | 否 | 房型、订单或活动范围和可售容量；未知或不匹配时不伪造可比结果 |
| assumptions | 类型化字段/受控结构 | 是 | 目标费率、原订单受影响范围、假设新增间夜及 ADR、预算和优惠承担等；逐项记录来源、单位、确认人和假设状态 |
| budget / projected_spend / actual_spend | DECIMAL / DECIMAL / 关联 | 否 | 预算、预计花费、同口径实际花费分别保存；实际值应关联已确认渠道事实 |
| projected_amounts | 类型化金额 | 否 | 情景收入、优惠、佣金、广告及渠道净收益；与已发生事实分开，并记录币种、公式和精度 |
| missing_items / comparability_status | 受控结构 / VARCHAR | 是 | 不完整时不排名、不假设为零 |
| rule_version_id | UUID | 否 | 存在规则判断时绑定已发布版本 |

定义：优惠前酒店房费 `G`、尚未从 `G` 扣除的酒店优惠 `D`、佣金 `C`、未计入其他项的广告及独立推广费 `A`。渠道净收益 `G-D-C-A`；若来源为已扣酒店优惠的收入 `R`，则用 `R-C-A`，不可重复扣 `D`。含税、退款、补贴、佣金基数和结算周期不一致时先标不可比。仅当全部适用变动成本确认完整、范围及分摊匹配且未重复计入时，才计算贡献收益；不完整不填零。

### 7.2 `experiment` 与 `experiment_result`

| 表.字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| experiment.diagnosis_id / hotel_id | UUID | 是 | 授权及归属一致 |
| experiment.type / status | VARCHAR | 是 | price/commission/advertising/promotion；draft/planned/running/stopped/completed |
| experiment.baseline / control | 受控结构 | 是 | 对照日期、范围、房型及数据版本；缺失时可保存草稿但不得宣称有效对照 |
| experiment.start_date / end_date | DATE | 是 | 试验日期；具体日期与时间口径明确 |
| experiment.original_value / target_value | 类型化值 | 是 | 原价/目标价、费率或预算及单位 |
| experiment.owner_id / stop_condition | UUID / TEXT | 是 | 责任人和已批准停止条件；无可用条件不形成正式试验建议 |
| experiment_result.business_date | DATE | 是 | 实际执行或经营日期 |
| experiment_result.executed_value / status | 类型化值 / VARCHAR | 否/是 | 实际执行与计划区分；人工记录执行、停止等 |
| experiment_result.metrics | 类型化值或逐日事实关联 | 否 | 出租率、ADR、房费、佣金、投流等；来源与确认状态必需 |
| experiment_result.manual_decision / reason | VARCHAR / TEXT | 否 | retain/adjust/stop/undetermined 及顾问依据；非自动因果判断 |

### 7.3 `report_version`、`report_review`、`report_delivery`

| 表.字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| report_version.diagnosis_id / revision | UUID / INTEGER | 是 | 同一诊断版本号唯一 |
| report_version.input_revision / snapshot_id / rule_version_id | INTEGER / UUID / UUID | 是/是/条件必填 | 输入修订属于该诊断；快照绑定完整选用值、假设和计算，未启用规则可标不适用 |
| report_version.status / content_ref | VARCHAR / 关联 | 是 | 审核状态 draft/pending/approved/rejected；交付状态单独记录，内容及文件私有 |
| report_review.report_version_id / reviewer_id | UUID | 是 | 仅有权限的顾问审核 |
| report_review.decision / reason / reviewed_at | VARCHAR / TEXT / DATETIME | 是 | approve/reject，记录意见及时间 |
| report_review.changes | 受控审计记录 | 否 | 修改字段、前后值、原因；新版本重新审核 |
| report_delivery.report_version_id / recipient_user_id / recipient_contact_id | UUID | 是/二选一 | 已审核版本及有权接收的系统用户或客户联系人；线上开放必须对应可登录且获授权的用户 |
| report_delivery.method / status / event_at | VARCHAR / VARCHAR / DATETIME | 是/是/条件必填 | online/manual；pending/available/sent/confirmed/failed/revoked，记录实际事件及状态变更，阅读另记，不由发送推断 |
| report_delivery.operator_id / evidence_ref | UUID / 关联 | 是/否 | 操作者及必要证据；人工发送不自动证明接收，不自动开放小程序访问 |

`follow_up` 保存酒店/诊断/试验关联、沟通日期、必要记录、负责人、下次行动和客户反馈；访问、留存及联系人处理同酒店授权。P0 只做人工记录，不隐含自动发送或定时提醒。

### 7.4 `follow_up` 一般行动和钻级跟进扩展

复用现有跟进记录；一条行动对应一条记录，普通沟通仍可单独记录。行动与沟通分别授权展示，不自动进入客户报告。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| hotel_id / diagnosis_id / experiment_id | UUID | 是/否/否 | 均须属于同一酒店；关联试验时其执行状态和结果以 `experiment` 为准 |
| record_kind / action_type | VARCHAR(24) | 是/否 | communication/action；行动可标 general/diamond_improvement 等，不要求另建自动评级模块 |
| action_description | TEXT | 行动时是 | 说明实际拟做的事情；不把建议描述为已执行 |
| owner_user_id / owner_role | UUID / VARCHAR(100) | 否 | 责任人为已授权用户或必要的角色描述；未确定可空，不默认分配或采集无关联系方式 |
| target_date / action_status | DATE / VARCHAR(24) | 否/行动时是 | 计划日期可未知；状态 pending/planned/in_progress/completed/paused/cancelled |
| tracking_metric / target_value | VARCHAR / 类型化值 | 否 | 指标名称、单位、统计周期及目标；未确认不得推断 |
| actual_result / result_source / recorded_at | 类型化值 / 关联 / DATETIME | 否 | 人工记录实际执行、结果和来源；完成状态需有实际执行记录 |
| baseline_diamond / target_diamond | VARCHAR(16) | 否 | 记录计划采用的当前钻级快照与目标；目标不改写 `hotel.diamond_level` |
| visibility | VARCHAR(16) | 是 | internal 或 approved_for_report；后者还须经过报告审核，不能自动公开跟进全文 |

状态、责任、目标与结果变更使用版本和审计记录留痕。正式报告只收录选中且审核通过的行动，与试验建议合计不超过 3 条；试验相关跟进引用试验状态，不单独保存另一份试验执行状态。

## 8. 规则、数据质量及安全约束

- `rule_version` 保存版本号、可配置参数、模板、审批人、发布时间和状态；仅服务端使用。业务层级、否决条件和其他限制需经过负责人批准，缺失时相应模块关闭。
- `audit_event` 保存操作者、酒店、资源、动作、时间和结果；不记录完整截图、完整报告、密钥或无关个人信息。
- 字段级来源与核实记录必须覆盖佣金、费率、优惠、流量及试验数据；`confirmed_by` 仅能是有权确认者，未知不可转换为确认零值。
- 业务唯一性：有效授权避免重复；逐日同口径事实避免重复；报告版本号在诊断内唯一；情景及报告计算绑定输入快照、事实版本和规则/公式版本。
- 金额、率、数量非负约束应结合退款等业务定义，不明口径先退回；费率通常为 0～1，但费率是否可相加由合同决定。日销量超可售、期间重叠或不一致均需人工核验。
- 原始数据修改、授权变更、报告审核/交付和删除均留痕；使用日志脱敏、传输及存储加密、限权下载和可验证备份恢复。
- 外部 OCR/模型的数据使用、训练禁止、存储地域、保留、删除与用户授权均须审批；截图库和规则库不得无授权发送到第三方。

## 9. 数据验收示例

1. **未知竞品佣金**：相关字段 `NULL`，状态 unknown；不得写入 0% 或推导市场佣金。
2. **优惠防重**：优惠前 22,000 元、酒店优惠 2,200 元、佣金 1,980 元、广告 0 元，净收益为 17,820 元；优惠后收入 19,800 元不得再扣 2,200 元。
3. **授权撤销**：顾问对酒店 A 的授权 revoked 后，立即拒绝读取其截图、报告和试验；已导出到外部的副本不能保证撤回。
4. **审核失效**：报告已审核后数据版本从 2 变 3，新报告须重新审核；旧报告按留存策略保持原版本。
5. **日期粒度**：月收入存在、日收入缺失时，日记录保持未知，不能平均分配并标记为已确认。
6. **分诊与酒店授权**：顾问仅获某条分诊授权时，可以查看该分诊，但不得读取随后关联酒店的诊断、截图或报告。
7. **费用不完整**：人工费用 5,000 元已确认、水电未知时，水电保持未知；最多展示明确标注的已采集费用小计，不得称总成本、GOP 或净利润。
8. **钻级目标**：当前 3 钻、目标 4 钻且无平台评定时，当前事实和既有报告保持 3 钻；目标只作为行动计划。
9. **新媒体问询**：浏览和问询存在但成交未知时，成交字段为 `NULL` 且状态为 unknown，不由问询推断订单。

## 10. 待确认事项

- 数据所有权、顾问授权和撤销流程、字段级确认主体与责任。
- 截图和渠道报表的可得性、合规来源、保存周期及第三方识别许可。
- 佣金叠加方式、优惠承担和结算基数，归因窗口及取消/退款处理。
- 同期可比、日维度业务日期、异常值、渠道净收益与贡献收益的业务口径。
- 报告审核责任、交付结果证明、数据留存和删除/备份清理时限。
- 佣金生效使用下单日或入住日、已有订单受影响范围、追加推广费及促销承担方；未知时不得按默认合同估算。
- 起草与审核可否同人、在线开放和人工发送的证明标准，以及各行动在不同渠道的实际决策权。
- Excel/CSV 模板和批量导入是否纳入一期；需先确认实际样例和数据量，当前不默认承诺。
- 分诊所需同意、指定顾问授权及撤销、在营适用条件和实际人工转交方式。
- 费用类别、来源、统计范围、期间和与渠道成本的重叠；GOP 与净利润如需自动核算须另行确认并扩展范围。
- 新媒体指标的原始定义、周期、数据来源、去重与成交证明；不默认建设平台自动采集。
- 一般行动的可见范围、责任主体、完成依据，以及平台钻级评定来源。
- 真实案例的授权、脱敏、处理主体、业务预期与验收责任。
- 数据库选择、备份恢复目标、字段级索引和最终物理设计。

## 11. V0.3.1 可选经营费用与新媒体事实

### 11.1 `operating_expense` 经营费用

建议粒度：**酒店 × 明确统计期间 × 费用明细 × 版本**。通常按自然月录入；非自然月须保留实际起止日和原因，不与其他期间直接合计。一个类别可以有多条可区分明细；不能只依类别判断不重复。

| 字段 | 类型 | 必填 | 单位/规则 |
|---|---|---|---|
| hotel_id / period_start / period_end | UUID / DATE / DATE | 是 | 酒店和包含起止日的期间，结束不得早于开始 |
| expense_category / description | VARCHAR(32) / VARCHAR(200) | 是/否 | labor/utilities/rent/commission/advertising/other；按实际来源归类 |
| amount / currency | DECIMAL(18,2) / CHAR(3) | 否/是 | 金额单位为对应币种；未知为 `NULL`，普通费用非负，冲回处理规则待确认 |
| expense_scope / channel_code | VARCHAR(24) / VARCHAR(32) | 是/否 | hotel/channel/other/unknown；渠道范围时记录渠道及分摊说明 |
| amount_kind / accounting_basis | VARCHAR(16) / VARCHAR(64) | 是/否 | actual/estimate/unknown；注明可得的结算、税费及统计口径 |
| channel_cost_overlap | VARCHAR(16) | 是 | yes/no/unknown；是否与已计入渠道净收益的佣金或广告重叠，未知不得按 no 处理 |
| source_ref / verification_status | 关联 / VARCHAR(20) | 否/是 | 关联字段级来源及确认记录；可以先保存未确认草稿 |
| confirmed_by / confirmed_at | UUID / DATETIME | 确认时是 | 有权确认者和时间；修改已确认值后重新确认并递增相关输入版本 |

仅在同一期间、币种、范围和金额类型内，所有纳入小计的明细已确认且能排除相互重叠时，可以显示“已采集费用小计”，标明实际或估算并展示组成和缺项；否则只展示单项和核对提示。实际和估算不得混成已发生金额，该小计不是总成本。渠道佣金或广告已扣除时不能重复扣；本版 P0 不使用该表自动计算酒店 GOP、经营利润或税后净利润。

### 11.2 `social_media_period` 新媒体统计

建议粒度：**酒店 × 平台 × 明确期间 × 账号或内容范围 × 来源 × 版本**。账号总体与单篇内容可能重叠，无法核实去重时不汇总。

| 字段 | 类型 | 必填 | 单位/规则 |
|---|---|---|---|
| hotel_id / platform_code | UUID / VARCHAR(32) | 是 | 酒店及平台；手工录入，不自动登录或抓取 |
| period_start / period_end | DATE / DATE | 是 | 明确统计日期及业务时区；不得混用不同事件周期 |
| account_or_content_scope | VARCHAR(200) | 否 | 账号、内容或汇总范围；只记录必要标识 |
| views / impressions / interactions | BIGINT | 否 | 浏览或播放、曝光、互动分别保存；非负，未知为 `NULL` |
| inquiries / confirmed_bookings | BIGINT | 否 | 问询与有可靠来源并经确认的成交订单分别保存；问询不等于订单 |
| metric_definitions / dedup_basis | 受控结构 / VARCHAR | 否 | 平台原始定义、单位、是否去重；未知不可推断一致 |
| booking_source / attribution_window | 关联 / VARCHAR | 否 | 成交证据和可得的归因窗口；无来源时不标已证实成交 |
| source_ref / verification_status | 关联 / VARCHAR(20) | 否/是 | 每个已展示为事实的指标保留字段级来源、确认人及时间 |

本模块不把浏览自动当作 OTA 曝光或点击，不将问询推成订单，不根据这些指标自动计算转化率、ROI 或新增订单。原有 `channel_daily` 中的渠道漏斗仍按自身已批准的口径和确认门槛计算。费用和新媒体资料被报告引用后发生修改时，关联诊断的输入版本须更新，新报告重新审核；历史已交付快照按留存策略保留。

---

## 12. `hotel_period` 周期经营事实

建议粒度：**酒店 × 周期起止日期 × 日期和指标口径 × 来源范围 × 事实版本**。支持自然月、非自然月和其他明确期间，不预先把每条周期事实绑定为“本期”或“同比”；其在某次诊断中的角色由快照成员记录。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| id / hotel_id | UUID | 是 | 唯一事实记录及酒店归属；引用时校验酒店和资源授权 |
| period_start / period_end | DATE | 是 | 含起止日；结束不得早于开始；日期按已确认酒店业务时区解释 |
| date_basis / scope | VARCHAR / 受控结构 | 是 | 入住房晚日、结算日或其他业务依据；记录房型、渠道及收入口径范围 |
| available_room_nights / sold_room_nights | INTEGER | 否 | 单位为间夜，未知为 `NULL`；确认计算出租率时可售大于 0，售出不超过可售 |
| room_revenue / currency | DECIMAL(18,2) / CHAR(3) | 否/收入时是 | 酒店客房收入及币种；须记录税费、退款、补贴、优惠和佣金扣除依据 |
| revenue_basis / amount_kind | 受控结构 / VARCHAR(16) | 否/是 | 优惠前或优惠后及其他会计口径；actual/estimate/unknown，估算不可冒充事实 |
| source_mode / source_ref | VARCHAR(24) / 关联 | 是/否 | manual/document/daily_aggregate 等；聚合时关联所选逐日事实版本和完整性说明 |
| verification_status / fact_revision | VARCHAR(20) / INTEGER | 是 | 记录状态及事实版本；字段级确认、来源、确认人和时间仍由证据关联保存 |

周期原始汇总与由日数据派生的汇总可以并存，但不得对同一范围重复相加。只有所需日数据和口径完整、经有权主体确认时才能派生周期事实；差异由有权主体核对并选择来源及理由。缺失的某日不得按月均值或零值填充。不同周期允许重叠保存，但不能未经核验就累加或用于同期比较。

## 13. `input_snapshot` 输入与计算快照

`input_snapshot` 是逻辑概念，可用不可变快照副本，或不可变事实版本加快照成员关系实现；不强制具体物理表数量。必须保证普通业务修改后仍能取得当时用于计算的值，而不是只保留可能被覆盖的记录 ID。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| id / diagnosis_id / hotel_id | UUID | 是 | 唯一快照及所属诊断、酒店；三者归属必须一致 |
| input_revision / created_at / created_by | INTEGER / DATETIME / UUID | 是 | 修订号仅在该诊断内有效，记录生成时间和操作者；一个修订可对应多个不同用途的快照 |
| selected_members | 受控成员集合 | 是 | 保存事实或假设的类型、来源记录 ID、事实版本、选用值、单位、统计口径、确认/未知状态及证据引用 |
| period_role / scenario_role | 受控集合 | 按需 | 为成员标识本期、同比、环比、基线或具体情景；同一事实可在不同诊断中有不同角色 |
| assumption_values / missing_items | 受控结构 | 是 | 保留实际输入的情景假设、来源和缺项，未知与确认零值分开 |
| rule_version_id / rule_state | UUID / VARCHAR | 按需 | 已批准规则及版本；未使用时记 not_applicable，缺失规则时标明缺口 |
| formula_version / engine_version | VARCHAR / VARCHAR | 有计算时是 | 足以定位计算公式或实现的版本；历史实现无法复用时如实提示不可复算 |
| precision_policy / rounding_policy / result_values | 受控结构 | 有计算时是 | 记录精度、舍入方式及当时结果；不得以当前默认参数替代历史配置 |
| retention_state / deletion_state | VARCHAR | 是 | 按批准的保留、撤回及删除策略处理；不把业务不可变当成永久保存许可 |

一个快照可以引用多个本店周期、逐日、渠道、佣金、促销、竞品、费用及情景记录；成员既可引用不可变版本，也可保存经授权的必要值副本。快照生成和报告版本关联应具有一致性：数据在审核期间发生变化时拒绝批准混合版本。生成新版本后，旧报告只代表旧输入；是否可在线查看由实时授权及交付状态控制。

若合法删除或留存到期，受控的快照、来源和报告按批准策略清理，包括受控备份；在清理未完成前分别记录在线副本、备份及失败状态。审计只保留依法允许且必要的最小信息，不利用日志恢复已删除的经营数据。

## 14. 异步任务、进度及删除记录

### 14.1 `business_job` 识别和导出

可共用一种任务结构；任务状态与字段确认状态、报告审核状态分开。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| id / job_type / hotel_id / diagnosis_id | UUID / VARCHAR / UUID / UUID | 是 | job_type 为 recognition/export；对象与操作人须属于相同授权范围 |
| source_ref / report_version_id | 关联 / UUID | 按类型 | 识别关联文件版本，导出关联已允许导出的具体报告版本 |
| requested_by / requested_at | UUID / DATETIME | 是 | 记录有权发起者及时间；下载结果时再次检查当前授权 |
| status / attempt_count | VARCHAR / INTEGER | 是 | queued/running/succeeded/failed/cancelled；记录已发生尝试，不把未完成标为成功 |
| idempotency_key / request_fingerprint | VARCHAR / VARCHAR | 是 | 在操作、资源及版本范围内识别重复请求；同一键对应不同请求内容时拒绝并提示冲突 |
| started_at / finished_at / result_ref | DATETIME / DATETIME / 关联 | 按状态 | 结果引用私有文件或结构化识别结果；只有成功写入且可核验时才标成功 |
| error_code / safe_error_message | VARCHAR / TEXT | 失败时是 | 可供定位和用户理解的失败原因，避免写入完整图片、报告或密钥 |

每次重试保留或可追溯尝试结果；单张图片可单独重试。用户明确发起新任务可使用新的请求标识；重复提交同一请求不能造成重复有效结果。向导当前步骤可保存在 `diagnosis.current_step`，不必单独建立进度表；保存成功及并发校验之后才更新该字段。

### 14.2 删除申请与审计

删除申请可使用专门记录或通用任务加受控明细，但至少包括申请人、酒店/诊断及目标范围、申请时间、处理人、状态、各受控位置的处理结果、备份到期清理状态及必要失败原因。建议区分待处理、处理中、在线数据已清理但备份待清理、全部完成、受限和失败；受限或失败不伪装成完成。具体保留期限、备份清理时限和可告知内容由法务确定。

`audit_event` 记录有权或被拒绝的访问、下载、审核、交付、授权及删除行为，字段至少包括操作者、酒店、资源类型/标识、动作、时间和结果；必要时记录受控原因。不得记录完整截图、完整报告、下载令牌、密钥或与审计无关的个人信息。

## 15. 行动权限与用途同意

### 15.1 `action_authority` 经营决策权

这是酒店是否有权实施某经营动作的事实，不替代顾问或业主登录系统时的资源权限。允许用结构化记录或等价字段实现。

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| hotel_id / action_type / channel_scope | UUID / VARCHAR / 受控结构 | 是 | action_type 区分 price/commission/advertising/promotion；渠道范围必须有依据，不能由一般渠道权限推断 |
| authority_status | VARCHAR(16) | 是 | self/approval/none/unknown；unknown 时不生成要求直接执行的行动 |
| approver_ref / evidence_ref | 关联 | 否 | 品牌方或其他审批主体及授权依据；未确认时保持未知 |
| effective_start / effective_end | DATE / DATE | 否 | 适用日期；无有效依据或过期时要求重新确认 |
| verification_status / confirmed_by / confirmed_at | VARCHAR / UUID / DATETIME | 是/确认时是 | 数据来源及有权确认主体；修改后影响相应诊断版本 |

只有明确的授权依据覆盖某行动和渠道时，才可将其用于该行动；不得从 `hotel.channel_authority=self` 自动推断全部行动均可自行决定。建议文案和实际按钮仍须同时通过系统资源授权、审核及业务规则检查。

### 15.2 `processing_consent` 用途同意记录

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| subject_id / granted_by | UUID | 是 | 适用主体与有权同意或授权人，法律主体与代理关系按实际情况确认 |
| purpose / scope_ref | VARCHAR / 关联 | 是 | 如首诊、酒店经营数据处理、顾问代确认、第三方识别；限定酒店、资源及处理范围 |
| notice_version / granted_at | VARCHAR / DATETIME | 是 | 对应告知或协议版本、同意时间和必要证据 |
| status / withdrawn_at | VARCHAR / DATETIME | 是/撤回时是 | active/withdrawn/expired；撤回不自动证明外部副本已清除 |
| source_ref / withdrawal_result | 关联 / 受控结构 | 否 | 同意依据、撤回后的受控处理结果及必要限制；不默认合并不同用途 |

首诊同意和指定顾问的首诊授权不替代酒店访问授权；对第三方识别还须完成供应商处理、数据用途和适用授权审批。撤销酒店访问后，按实际仍有效的首诊授权处理首诊访问；撤回某处理用途后阻止不再获准的新处理，删除及备份按批准策略执行。

## 16. 三方案数据完整性与计算约束

| 方案/数据 | 形成可计算结果的最低信息 | 缺失时处理 |
|---|---|---|
| 共同基线 | 酒店、渠道、日期/日期依据、房型及订单范围、币种、可售容量、已确认收入及适用成本口径 | 保留草稿和各项来源；缺相关基线或成本时不输出该项完整收益 |
| 加佣 | 合同生效依据、适用房型和活动、基础/额外费率关系、原订单受影响基数、假设新增间夜与 ADR | 未知范围不默认为全部原订单或零；新增结果始终标为假设 |
| 投流 | 预算或预计花费、实际支出分别记录；计算归因单成本还须匹配归因订单、人群和窗口 | 预算不能替代实际花费，归因不能替代因果增量 |
| 促销 | 优惠前或已扣优惠收入、酒店/平台/其他方分担、原订单受影响范围、佣金及费用口径 | 已扣优惠的收入不再扣优惠；承担方或范围未知时相关促销分析列缺项 |
| 贡献收益 | 同范围全部适用变动成本、分摊依据、确认状态及与优惠/佣金/推广费的防重结果 | 成本未知或完整性不能证明时不可计算，不以部分费用称完整贡献收益 |

渠道净收益使用 `G-D-C-A`，或在酒店承担优惠已经计入收入时使用 `R-C-A`；`A` 只包含酒店承担且未在佣金或优惠中重复扣除的广告及独立推广费。该指标不等于 GOP、酒店经营利润或税后净利润。跨币种、不同税费或退款口径、不同房型/期间，未核实转换和可比性前不能排序。具体规则、精度和舍入应随快照记录并由甲方确认，不把文档示例当作已签收的财务政策。

在分组互不重叠且各组预计间夜、酒店优惠后实际成交 ADR 假设齐备时，`R情景 = Σ(间夜k × ADRk)`；佣金按各组实际合同计费基数及费率、已确认且未重复的固定佣金费用计算，特殊阶梯或封顶按已确认条款处理。`情景渠道净收益 = R情景 − C情景 − A情景`，与相同口径的基线相减得到假设变化；任何必要分组、合同费用或变动因素未知时保持不可计算，不自动设零。

示例：同一酒店、渠道、房型和周期内，原订单收入 20,000 元，原佣金 10%；假设合同按入住日期生效，其中 10,000 元受 12% 新费率影响，其余仍按 10%，则原订单新增佣金 200 元。另假设新增 5 间夜、ADR 200 元、佣金 12%，则新订单佣金 120 元；在优惠、广告、独立推广费及固定佣金均经确认无发生且可售容量足够时，新渠道净收益为 `21,000 − 2,320 = 18,680 元`。假设新增间夜不是事实；未提供完整变动成本时不能称其为利润。

## 17. 与需求及验收的对应

完整需求、页面/模块、主要数据和对应验收见[需求追踪与验收矩阵 V0.3.2](./revenue-diagnostic_需求追踪与验收矩阵_V0.3.2.md)。第 12～16 节的建议结构应与 PRD 第 21～22 节共同评审；追踪表中的“部分”和“待补”是尚需完善的验收设计，不代表测试已经通过。
