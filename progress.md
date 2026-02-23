# 末日生存肉鸽游戏 - 开发进度
Original prompt: 修复夜晚显示与白光问题、提升像素写实美术、完善基地/伙伴/建造系统，并修复子弹停火与 UI 重叠等 Bug。

## 项目信息
- **框架**: Phaser 3.80.1 + TypeScript + Vite
- **分辨率**: 800x450 (高清像素风，自动缩放)
- **世界大小**: 2000x1500
- **平台**: 浏览器跨平台

## 已完成功能

### 阶段1: 核心可玩 ✅
- [x] 玩家死亡机制 + 游戏结束重开
- [x] 波次系统，递增难度
- [x] 击杀掉落 + 资源拾取
- [x] 简单建造（放置墙壁）

### 阶段2: 日夜循环 ✅
- [x] 时间系统（白天/夜晚交替）
- [x] 白天探索阶段
- [x] 夜晚防守阶段
- [x] UI显示当前时间和阶段

### 阶段3: 伙伴系统 ✅
- [x] 营救机制（白天在地图上发现幸存者）
- [x] 伙伴AI（跟随玩家）
- [x] 伙伴自动射击敌人

### 阶段4: 完整建造系统 ✅
- [x] 建造菜单 (B键)
- [x] 墙壁 (1键，10木材)
- [x] 防御塔 (2键，5木材+10金属，自动射击)
- [x] 路障 (3键，15木材)
- [x] 建造预览和资源检查

### 阶段5: 肉鸽元素 ✅
- [x] 随机升级（每2波选择1/3技能）
  - 快速射击、强力射击、再生、加速
  - 伙伴训练、炮塔过载
- [x] 难度递增（波次越高，敌人越强）
- [x] 血量/速度缩放

### 阶段6: 丰富内容 ✅
- [x] 多种敌人类型
  - 普通僵尸：标准敌人
  - 跑者（红色）：快速但血量低
  - 坦克（紫色）：慢速但血量高
- [x] 更新主菜单显示游戏特色

### 阶段7: 视觉升级 ✅ (新增)
- [x] 分辨率提升: 320x180 → 800x450
- [x] 精灵升级: 16x16 → 32x32像素（Tank为48x48）
- [x] 精细角色设计：
  - 玩家：战术背心、发型、眼睛细节、枪械
  - 僵尸：腐烂效果、发光红眼、撕裂衣服、爪子
  - 跑者：瘦长身形、可见肋骨、尖牙、长爪
  - 坦克：巨大体型、装甲板、小头大身
- [x] 粒子效果系统：
  - 枪口闪光 + 火花飞溅
  - 血液溅射效果
  - 死亡爆炸（血液+烟雾+灰尘）
  - 冲击波效果
- [x] 建筑精灵升级: 32x32 → 64x64像素

### 阶段8: 技能系统深化 ✅ (新增)
- [x] 玩家技能曲线：
  - 经验值系统，升级获得属性提升
  - 8种技能: 神枪手、快速射击、锐眼、活力、铁皮、再生、远程专家、疾跑者
  - 技能升级消耗资源
- [x] 同伴随机子弹效果（10种）：
  - 普通、爆炸、穿透、冰冻、燃烧
  - 毒素、连锁闪电、追踪、散射、激光
- [x] 伤害数字显示 + 暴击效果
- [x] 等级显示 + 经验条UI

### 阶段9: 建造系统增强 ✅ (新增)
- [x] 建造类型扩展：
  - 防御类: 围墙、加固围墙、路障、尖刺陷阱、自动炮塔、激光炮塔
  - 生产类: 发电机、集水器、农场
  - 设施类: 储藏室、医疗帐篷、瞭望塔
  - 装饰类: 篝火、旗帜
- [x] 建造菜单UI (分类显示)
- [x] 建筑解锁系统（根据天数）
- [x] 建筑特殊效果：减速、伤害、生产、治疗、增加射程

## 操作说明
- **方向键**: 移动
- **自动射击**: 自动攻击范围内敌人
- **B键**: 切换建造模式
- **1/2/3键**: 选择建筑类型
- **鼠标点击**: 放置建筑（建造模式下）

## 游戏循环
1. 白天：探索地图，营救幸存者，收集资源
2. 夜晚：防守基地，抵御僵尸波次
3. 每2波获得随机升级
4. 存活越久，难度越高

## 运行命令
```bash
npm install
npm run dev
```
打开 http://localhost:5173

## 文件结构
```
src/
├── main.ts           # 入口点
└── scenes/
    ├── BootScene.ts  # 资源加载、精灵生成
    ├── MenuScene.ts  # 主菜单
    ├── GameScene.ts  # 核心游戏逻辑
    └── UIScene.ts    # HUD覆盖层
```

## 最新进展（2026-02-04）
- [x] **运行状态保护**：GameScene 内置 `defaultRunState`，在 BootScene 未运行时自动初始化，所有资源写入统一通过 `getRunState()`，彻底消除 `runState` 为 `undefined` 导致的建造/资源崩溃。
- [x] **营地结构修复**：墙体/炮塔改为动态物理组，创建时统一调用 `configureStructure` 设置 `immovable` 和 `allowGravity=false`，同时在四个方向留出通道，解决“隐形墙”与 `setImmovable` 报错。
- [x] **武器/子弹修正**：玩家武器现在避开墙体障碍生成，子弹物理体重置并使用居中的圆形碰撞盒，避免只飞出一小段或穿过僵尸不结算伤害的问题。
- [x] **测试钩子**：暴露 `window.render_game_to_text` 与 `window.advanceTime(ms)`，方便 Playwright 自动化读取状态、推进时间；同时记录敌人/资源摘要。
- [x] **生产验证**：`npm run build` 通过，确保 TypeScript 编译与 Vite 打包均稳定。

### TODO
- [ ] 编写 Playwright 动作脚本并实际跑一次 develop-web-game 测试循环，校验新钩子。
- [ ] 继续 A1 伙伴系统冲突清理，统一 `CompanionSystem` 配置和 UI。
- [ ] 补上 base 场景美术细节（路灯光晕、地表材质）在夜间的可见度微调，确保玩家直观感知营地边界。

## 最新进展（2026-02-05）
- [x] `advanceTimeManual` 现在会同步推进 Phaser Clock（调用 `time.preUpdate/update` 并维持一个累积时间戳），`window.advanceTime` 在测试环境下可以正确触发自动射击、计时器和延时事件，解决“只有第一发子弹会射出”的问题。
- [ ] Playwright 依赖 `playwright` 在当前离线环境下无法安装，`develop-web-game` 客户端暂未能运行，等待网络恢复后补跑自动化测试。
- [x] 玩家/同伴子弹在对象池复用时会清理旧的寿命 `TimerEvent`，避免第二发被前一发的延迟定时器立即 `disableBody`，现在连续射击和命中特效都能稳定复现。

## 最新进展（2026-02-06）
- [x] 修复夜晚左上黑色方框：`lightingLayer` 设置 `setOrigin(0,0)` 并每帧 `clear()`，夜间遮罩覆盖世界对齐正确。
- [x] 角色/建筑像素美术重绘：玩家、僵尸、跑者、坦克、队友；墙体、炮塔、路障、发电机、农场、储藏、医疗、瞭望塔、篝火；基地房屋与地表纹理更细节化、更贴合科幻末日风格。
- [ ] Playwright 自动化仍未运行（依赖离线），待可用后补跑截图+render_game_to_text 校验。
- [x] 夜间白光问题修复：`lightingLayer` 改为 `erase` 方式开洞（不再绘制白光），并收敛灯光半径与村庄灯光强度。
- [x] 地图整体风格转向像素写实：去除霓虹网格与高亮边框，改为低饱和区块色、细碎颗粒纹理、低对比地表装饰。
- [x] 基地生存系统一期：新增 `BaseSystem`（电力/食物/岗位统计、日结算）、新增厨房设施、发电站供电逻辑、炮塔电力上限约束、伙伴驻守/出战与岗位分配的 `基地管理` 面板（`T` 键）。
- [x] 基地建造数据补齐：建筑新增 `jobType/jobSlots/powerProvided/powerUse` 字段，日结算按建筑+岗位产出，资源栏显示电力状态。
- [x] 修复武器槽遮挡对话：武器槽/武器名移动到右下侧边显示。
- [x] 修复升级后子弹不出：VS武器发射改为 `enableBody` 并清理寿命计时器，子弹命中后正确回收。
- [x] 防止连击文字崩溃：`comboText` 纹理失效时自动重建，避免 `drawImage` 报错。
- [x] 修复 VS 子弹卡住：`fireVSWeapon` 先 `body.reset` 再设置速度，避免清零速度导致子弹停在玩家身边。
- [x] 修复散射后子弹停摆：清理 VS/主武器共用子弹池的双计时器冲突，命中时同步清理 `lifetimeTimer/vsLifetimeTimer`。
- [x] 剧情框避让小地图：缩窄 StoryOverlay 宽度，文本与边框按新宽度布局。
- [x] 修复子弹系统残留数据：主武器发射时统一重置 `weaponDamage/weaponSpecial`，并让命中逻辑优先读取正确字段，避免多套子弹切换后停火。
- [x] 顶部文字重叠修复：将评级与微信群文本分离位置显示。
- [x] 基地路障遮挡房屋修复：房屋位置内移并对齐格点。
- [x] 驻守伙伴可见：驻守伙伴会在基地内部显示为“居民”，出战/驻守状态切换即时生效。
- [x] 子弹回收健壮化：回收时统一清理所有子弹字段，避免多套技能/子弹系统造成池耗尽。
- [x] 子弹系统彻底隔离：VS 子弹使用独立对象池，避免与主武器共享导致互相污染与池耗尽。
- [x] 顶部文字再次避让：评分与微信群位置进一步拉开，避免重叠。
- [x] 建造菜单交互修复：建造模式下点击 UI 不再触发世界放置，标签选中状态高亮并可切换类别。
- [x] 子弹停火兜底修复：新增子弹池回收清理与越界/低速/超时回收，防止子弹卡在玩家附近导致池耗尽。
- [x] 子弹强度回调：主武器与 VS 基础武器伤害上调，前期火力更可靠。
- [x] 基地管理关闭修复：关闭按钮提升输入优先级，避免被背景吞掉；增加 ESC 快捷关闭。
- [x] 伙伴名单同步修复：UI 收到伙伴更新时自动补齐 GameState 伙伴数据，基地管理显示完整人数。
- [x] 伙伴名单二次兜底：GameScene 同步伙伴时补齐 GameState，避免 UI 未触发导致名单缺失。
- [x] 基地日结算反馈：白天开始时提示建筑/岗位产出与食物消耗/缺粮警告。
- [x] 缺粮惩罚生效：缺粮时玩家与伙伴伤害降低（最高 50%）。
- [x] 电力超载机制：电力不足时部分炮塔停机并提示，UI 显示超载警告。
- [x] 基地面板信息增强：显示出战/驻守人数与电力超载提示。
- [x] 日结算提示延迟：避免与“第X天”公告重叠导致看不见。
- [x] 缺粮提示常驻提醒：战斗中周期性提示伤害下降。
- [x] 基地管理关闭兜底：增加大范围关闭点击区 + UI 场景 T 键兜底。
- [x] 建造放置体验修复：引入放置“解锁”延迟，避免选中建筑后立刻落地；预览始终跟随鼠标。
- [x] 任务 HUD 修复：接受/进度/完成时刷新左上角任务目标显示。
- [x] T 键重复触发修复：GameScene 中避免与 UIScene 双重切换导致无法关闭。
- [x] 基地面板交互修复：点击驻守/出战/岗位不再叠加面板，刷新使用 destroy+show。
- [x] 伙伴跟随/射击兜底：距离过远自动拉回玩家附近；同伴子弹物理体与伤害字段补齐。
- [x] 伙伴攻击兜底：扩大索敌范围，若范围内无敌人则锁定最近目标，避免“发呆”。
- [x] 建造体验改回直观：移除弹出建造面板，改为屏幕内建造提示 + 滚轮切换建筑，点击即放置。
- [x] 伙伴子弹修复：同伴子弹组改为 Arcade 物理组并指定默认纹理，确保正常发射与命中。
- [x] 基地面板交互再修复：驻守/岗位切换后采用 hide+延时重开，避免遮挡导致无法关闭。
- [x] 建造提示避让：建造信息框移到右下上方，避免遮挡小地图。
- [x] 伙伴索敌再强化：若伙伴附近无敌人，改锁定玩家附近敌人以确保攻击。
- [x] 敌人掉落修复：EnemySystem 挂接 ENEMY_DEFS lootTable/xpValue/damage，恢复资源掉落。

## 最新进展（2026-02-07）
- [x] 建造提示避让小地图：建造信息框与小地图检测重叠时自动上移，避免遮挡。
- [x] 基地管理关闭兜底加强：点击驻守/岗位后改为立即重建面板，避免遮挡导致无法关闭。
- [x] 敌人攻墙恢复：敌人靠近基地结构时优先攻击墙/炮塔，确保城墙受损。
- [x] 资源掉落兜底：战利品表未触发时强制落一份基础资源，避免“完全不掉”。
- [ ] Playwright 截图仍为黑屏（可能是 headless/WebGL 捕获问题），需在本机目测验证。
- [x] 资源掉落加强：怪物必定额外随机掉落一类资源（全资源池），缓解建造资源短缺。
- [x] 子弹稳定性强化：主武器回收逻辑改为最旧回收 + 时钟回退保护，避免停火；清理循环包含伙伴子弹。
- [x] 伙伴战斗增强：补齐 homing 标记、pierce 计数与 bullet 状态重置；伙伴子弹池可回收，避免池耗尽。
- [x] 伙伴子弹特效生效：爆炸/冰冻/灼烧/中毒/连锁/贯穿处理。
- [x] 建造选择更直观：建造模式下数字键 1-6 可直接切换建筑。
- [x] 资源掉落增强：每击杀额外随机掉落 1-3 份资源（全资源池），血月加成。
- [x] 编译稳定性修复：清理 GameScene/Panels/LootSystem 的 TS 错误，`npm run build` 可通过。
- [x] 白天休闲系统：新增 `LeisurePanel`（H键），支持牌局/音乐会/AR对练，每天一次，白天限定，奖励资源+经验。
- [x] AR眼镜实装：图鉴可“设为当前装备”，HUD显示当前眼镜；`EvolutionSystem` 把装备眼镜被动加成接入真实数值。
- [x] AR特殊效果接入战斗：神经链可触发额外连锁；涌现/AI辅助可让VS子弹获得追踪。
- [x] 夜战强度提升：波次敌人数、刷怪间隔、总波次数按周次/波次抬升，血月压力明显增加。
- [x] 素材增强：新增水/医疗/能量核心掉落贴图，资源掉落从彩色圆点升级为像素道具精灵。

## 最新进展（2026-02-07 夜间续）
- [x] 资源模型扩展：新增 `bitcoin` 资源，并修复 `GameState.load()` 深合并逻辑，避免旧存档缺字段导致异常。
- [x] 交易系统实装：新增 `BaseSystem` 每日浮动汇率与兑换接口，支持“资源 -> 比特币”交易（类股市日波动）。
- [x] 新 NPC 语义重构：
  - 数据商人 -> `数据交易员`（打开 `ExchangePanel`）
  - 觉醒者领袖 -> `任务官`（直接派发随机任务）
  - 武器工匠 -> `宝岛眼镜店`（打开 `GlassesShopPanel`）
- [x] 随机任务简化：新增 `QuestSystem.acceptRandomQuestFromGiver()`，E 交互即可接到一条随机任务并给出即时目标提示。
- [x] 眼镜经济闭环：新增 `GlassesShopPanel`，用比特币购买不同品牌 AR 眼镜；购买后可在图鉴中装备。
- [x] 品牌弹幕树：`EvolutionSystem` 新增品牌技能树与战斗修正（攻速/伤害/投射物/穿透/追踪/特殊弹道），并接入 `GameScene.fireVSWeapon()`。
- [x] 白天时长调整：`DayCycleSystem` 改为 100 秒循环（白天约 65 秒 / 夜晚约 35 秒）。
- [x] 白天反馈增强：日结算新增“今日行情 + 眼镜指数”浮层提示，方便白天经营决策。
- [x] UI 可见更新：
  - HUD 资源栏新增 `₿` 显示；
  - HUD 新增当前眼镜对应“弹幕树”显示；
  - 操作提示新增 `X:交易`；
  - 建造提示框重叠小地图逻辑继续修正（优先右侧避让）。
- [x] 敌人攻墙策略补强：`EnemySystem` 提高结构优先逻辑稳定性，减少“只追玩家不打墙”现象。
- [x] 编译验证通过：`npm run build` 通过。

### 待继续
- [ ] Playwright 截图在当前环境仍为黑屏（但构建通过）；需要用户本机前台窗口实测新 UI/交互是否符合预期。
- [ ] 把“宝岛眼镜店”从纯列表购买升级为品牌分页 + 试戴对比 UI。
- [ ] 为交易所增加“批量卖出/一键清仓富余资源”与风险提示。
- [ ] 继续补完整“白天休闲小游戏”可交互玩法（当前是奖励面板形态）。

## 最新修复（2026-02-07 深夜）
- [x] 任务交互回退为“可选任务”流程：与任务官交互不再自动接任务，改为打开任务面板手动选择。
- [x] 任务计数修复：
  - 建造任务支持分类匹配（`wall` 目标可计入全部防御类建筑，`turret` 目标可计入全部炮塔类）。
  - 收集任务接入 `LOOT_COLLECTED` 事件，拾取资源会实时推进任务。
  - 存活任务在每日开始时推进一次，解决“天数到了不完成”问题。
  - 接任务时会根据当前存量/现状回填初始进度，避免“先做后接导致卡死”。
  - 精英/Boss 击杀目标做了宽匹配兜底，避免命名不一致导致无法完成。
- [x] 子弹系统可见性强化：
  - 主武器发射链路正式接入品牌修正（攻速/伤害/弹数/散布/速度/特殊弹道）。
  - 特殊弹道有明显视觉区分（颜色/尺寸），避免“看不出变化”。
- [x] 画面可见改动增强：
  - 主场景地表增加分区像素斑块层（城市/丛林/荒野/工业视觉更明显）。
  - 菜单页背景与按钮风格增强对比，首屏变化更直观。

## 最新进展（2026-02-07 深夜二次美术重构）
- [x] `BootScene` 素材系统重做：角色、敌人、伙伴、子弹、建筑、掉落、粒子、村庄贴图全部重绘为新像素素材（透明底程序精灵），替换旧版“同质化块状”表现。
- [x] 新增世界地表纹理资源：`zone_city_tile / zone_jungle_tile / zone_wasteland_tile / zone_industry_tile / zone_road_tile`，并新增环境装饰精灵：`deco_tree / deco_ruin / deco_machine / deco_crater`。
- [x] `GameScene` 背景渲染链重构：由纯色块改为“分区贴图 + 道路贴图 + 雾层 + 装饰层 + 基地框层”，进入游戏时可见大幅度画面变化。
- [x] `GameScene` 基地布局微调：双房屋位置、农田、补给箱、公告牌、灯光层做了对齐和层级优化，整体观感更像“可生活营地”。
- [x] `MenuScene` 完整重做：主菜单增加场景贴图背景、角色敌人阵列展示、功能芯片条，开局界面可直接看到新素材体系。
- [x] 编译验证：`npm run build` 通过。

### 继续计划（画面专项）
- [ ] 接入外部精灵图工作流：在可用 `OPENAI_API_KEY` 的环境下使用 `imagegen` 批量产出透明底 PNG（角色/NPC/建筑/UI 图标），替换当前程序绘制精灵。
- [ ] 分图层地图：将当前分区贴图继续细化为“底纹 + 地物 + 光照遮罩 + 地块边缘过渡”四层，消除硬切分区感。
- [ ] UI 风格统一：右下武器槽、小地图框、任务面板、基地面板统一一套边框/字体/图标风格，减少“美术风格混杂”。

## 最新修复（2026-02-07 任务与子弹链路）
- [x] 任务系统改为可持续循环：
  - 新增 `QuestSystem.MAX_ACTIVE_QUESTS = 3`，同时进行任务上限为3。
  - 任务官交互改为“随机派发1个任务（未满时）+ 强制打开任务面板”。
  - 随机任务池加入 repeatable 兜底，做完后可继续接，不会卡死在“无任务可接”。
- [x] 任务面板可视修复：
  - 顶部显示 `进行中任务 x/3`。
  - 任务满额时显示提示并阻止继续接取。
  - 新增 `open-quests` 事件，避免 `toggle` 导致“看起来打不开”。
- [x] 子弹停火与升级伤害修复：
  - `GameScene.weaponTimers` 在 `create()` 时清空，并增加时间回退保护，修复“新子弹打一发后停火”。
  - `WeaponSystem` 接入等级缩放：主武器六种形态会按对应武器槽等级提升伤害/射速/射程/弹速；未解锁槽位时也按玩家等级提供基础成长，避免始终原始伤害。

## 最新修复（2026-02-07 伙伴与基地管理）
- [x] 基地管理面板 `T` 失效根修：
  - 修复 `SlidePanel.hide()` 的异步销毁引用错误，避免旧 tween 回调误删新容器导致 `isOpen=true/container=null` 卡死。
  - `toggle()` 增加状态自愈，遇到脏状态自动重置。
  - `UIScene` 的 `BASE_UPDATED` 改为 `basePanel.refresh()`，不再 `hide+show` 竞争。
- [x] 伙伴跟随防卡与紧跟优化：
  - 新增“动态跟随半径 + 中距离强追 + 远距离回收传送”。
  - 降低伙伴卡墙概率：取消与基地结构的物理碰撞，改由跟随逻辑维持编队。
  - 伙伴物理体增加拖拽与速度上限，减少抖动和走丢。
- [x] 伙伴职业产出系统落地：
  - 驻守伙伴按职业每天提供不同资源（如厨师→食物，工程师/建筑工→零件与金属，拾荒类→材料等）。
  - 日结算浮字纳入职业产出。
  - 基地面板每个伙伴显示“角色定位 + 驻守加成”说明，明确属性价值。

## 最新修复（2026-02-07 任务奖励 + 眼镜弹道 + 伙伴岗位卡）
- [x] 任务完成奖励可见化：
  - `QuestSystem.completeQuest` 追加 `update-resources` 事件，资源栏即时刷新。
  - `GameScene.onQuestCompleted` 显示“奖励明细”（资源/XP/技能点），不再只显示“任务完成”。
- [x] 任务不再“接了就完成”：
  - 接任务进度统一从 `0` 开始，不读取历史存量，避免一键秒完成。
  - 任务官随机派发增加“非剧情/非低目标值”倾向，减少过于简单任务。
- [x] 新眼镜购买后子弹视觉立即变化：
  - 眼镜商店购买后自动装备并触发 `glasses-equipped`。
  - 品牌弹幕树新增 `tintColor`，主武器与VS子弹在非特殊弹道下使用品牌色。
- [x] 伙伴职业数值卡 + 一键分配岗位：
  - 基地面板新增“战斗属性摘要 + 驻守加成 + 推荐岗位”。
  - 新增“一键分配岗位”按钮，按职业/角色自动分配到可用岗位。
- [x] 任务奖励补强：`QuestSystem.completeQuest()` 结算时固定追加小额比特币奖励（按任务层级浮动，单次 `< 1`），并写回任务完成浮层。
- [x] 奖励显示优化：任务完成浮层对非整数资源（如 `bitcoin`）按两位小数显示。
- [x] 建筑贴图精细化：`BootScene.generateStructureSprites()` 新增/重绘建筑精灵（加固墙、防护门、电磁陷阱、电网围栏、地雷区、3类高级炮台、厨房、净水装置、弹药工厂、医疗站、雷达、工作台、传送门、护盾发生器、旗帜），并把基础墙体做成无透明边的满格贴图以减少拼接缝。
- [x] 基地美术重做：`GameScene.createVillageScenery()` 改为“店铺基地”布局，新增门头牌与店内柜台，招牌文案为 **影目AR眼镜体验中心**。
- [x] 基地结构拼接修复：`createBaseWalls()` 改为按网格中心精确摆放边界墙，修复原先偏移导致的缝隙/错位。
- [x] 建造系统素材接线：新增 `getBuildingTextureKey()`，`placeBuilding()` 改为按建筑 ID 选择贴图，不再只用 `wall/turret` 两类。
- [x] 编译验证：`npm run build` 通过。
- [ ] develop-web-game Playwright 自动截图在当前环境未产出可用截图（客户端命令返回空输出），仍需本机实际进场视觉回归确认。
- [x] 基地美术统一套件二次精修：重绘 `village_ground/village_path/street_lamp/store_front/store_counter`，路面、灯具、店面材质统一到同一像素写实风格。
- [x] 基地中文牌匾扩展：在店内新增功能牌匾（`数据交易区`、`眼镜体验区`、`任务中心`），提升可读性与场景叙事。
- [x] 子弹系统稳态修复（眼镜树回归向）：
  - VS 武器计时从按 `weapon.id` 改为按 `slotKey` 计时，避免多武器/进化后计时冲突。
  - VS 发射改为“发射成功才写入本轮计时”；弹池饱和时自动回收最老子弹并重试。
  - 新增 `acquireBulletFromGroup/recycleOldestActiveBullet`，修复“打一发后停火”型弹池卡死路径。
  - 主武器现在也接入品牌 `homing` 属性，`updateHomingBullets` 同步处理主武器/VS/伙伴三类子弹。
  - 追踪子弹保留原速（基于当前速度夹取）而非固定降速，减少追踪过程中的异常停滞。
- [x] 构建验证：`npm run build` 通过。
- [ ] Playwright 客户端命令返回成功但未在当前环境输出可见截图/日志，仍需本机实机回归确认视觉与停火问题。
- [x] Playwright 稳定化（mac）：新增 `scripts/web_game_playwright_client_mac.js`，默认优先锁定 Chrome for Testing 可执行文件（从 `~/Library/Caches/ms-playwright/chromium-*/...` 自动探测），找不到再 fallback 到系统 Chrome。
- [x] 新增一键命令：`npm run test:game`，统一输出到 `output/web-game`。
- [x] 输出可靠性增强：强制写出 `run-meta.json / shot-0.png / state-0.json / errors-0.json`，异常写 `fatal.log`；启动前清理旧 artifacts 避免误判。
- [x] 实机验证：在当前 Mac mini M4 环境，使用 Chrome for Testing 路径可稳定产出非黑屏截图。
- [x] 测试启动钩子实装：`MenuScene` 暴露 `window.__startGameForTest()`，Playwright 可无视按钮命中率稳定进入 `GameScene`。
- [x] 文本状态钩子补齐：`MenuScene` 与 `GameScene` 都提供 `window.render_game_to_text()`，并带 `scene` 字段（menu/game），自动化可确定当前场景。
- [x] `GameScene` 额外暴露 `window.__in_game` 标记，测试脚本可快速判定是否进场。
- [x] Playwright 客户端升级：`hasEnteredGame()` 基于 `render_game_to_text.scene` 判定，不再依赖 DOM 文本。
- [x] 验证通过：`npm run test:game` 现可稳定进入游戏场景并输出 `scene=game` 的 `state-0.json`；截图为基地内实战场景。

## 最新进展（2026-02-08 深夜：itch 素材导入管线）
- [x] 新增合规素材流水线脚本：`scripts/itch_assets.mjs`
  - `discover`：从 `https://itch.io/game-assets/free.xml` 发现条目并落盘清单。
  - `ingest`：把本地已下载素材包映射到游戏贴图 key，复制到 `public/assets/third_party/<slug>/`。
  - 自动更新 `src/data/assetOverrides.ts` 与版权记录 `assets/itch/attribution.json`。
- [x] 新增资产命令：`assets:init / assets:discover / assets:ingest`（见 `package.json`）。
- [x] `BootScene` 接入素材覆盖机制：
  - 预加载 `ASSET_OVERRIDES` 中的外部贴图。
  - 程序化贴图生成改为“仅缺失时生成”，避免覆盖外部素材。
- [x] 新增素材目录与清单：
  - `assets/itch/asset-overrides.json`
  - `assets/itch/attribution.json`
  - `public/assets/third_party/.gitkeep`
- [x] 回归验证：`npm run build` 通过；`npm run test:game` 通过并产出 `output/web-game/shot-0.png` 与 `scene=game` 状态文件。

### 下一步建议
- [ ] 用 `assets:discover` 生成候选列表后，先挑 1 套授权明确的像素素材包做首批替换（建议优先：`player/zombie/wall/turret/ui_icon`）。
- [ ] 加一个 `assets:remove`（按 key/slug 回滚）命令，便于快速 AB 测试不同素材包。

## 最新进展（2026-02-08：itch 风格素材筛选启动）
- [x] 通过 `npm run assets:discover` 拉取 itch 免费素材清单（36 条），作为候选池。
- [x] 新增风格化候选清单：`assets/itch/curated-pixel-scifi-packs.json`
  - 已按“像素 + 科幻 + 顶视角 + 可用于基地建设/夜战”给出 6 个候选包与目标替换 key。
- [x] 新增首批接入方案：`assets/itch/first-batch-ingest-plan.md`
  - 明确三阶段替换（基地地图 -> 角色敌人 -> 子弹/UI）。
  - 提供可直接执行的 `ingest` 命令模板。
- [x] 回归验证：`npm run build` 与 `npm run test:game` 均通过。

### 下一步（等待素材包本地落地后执行）
- [ ] 对 `cainos-topdown-basic` 和 `limezu-modern-interiors` 执行首批导入，先替换 `zone_* / wall / gate / store_*`，确保开局画面有明显变化。
- [ ] 第二批导入 `cyberpunk-character-pack`，替换 `player/companion/zombie/runner` 并做碰撞盒回归。
- [ ] 逐包补齐 `assets/itch/attribution.json` 中的 license/attribution 实值，保证后续发布合规。

## 最新进展（2026-02-08：自动下载+解压+接入首包素材）
- [x] 验证“可自动下载”：通过 itch 页面流程（`download_url` -> 下载页 `upload_id` -> `/file/<upload_id>`）自动拿到临时直链并下载 zip。
- [x] 自动落地与解压：
  - 下载文件：`assets/itch/downloads/cainos-pixel-art-top-down-basic-v1.2.3.zip`
  - 解压目录：`assets/itch/extracted/cainos-topdown-basic`
- [x] 新增切片脚本：`scripts/slice_cainos_pack.py`
  - 从大图自动裁出第一批可用素材（地表/墙体/门/店铺/玩家/工作台等）。
  - 输出目录：`assets/itch/sliced/cainos-topdown-basic`
- [x] 首包接入完成（14个 key）
  - 通过 `scripts/itch_assets.mjs ingest` 写入 `ASSET_OVERRIDES`。
  - 已覆盖 key：`zone_city_tile/zone_wasteland_tile/zone_industry_tile/zone_road_tile/wall/gate/reinforced_wall/barricade/player/store_front/store_counter/storage/workbench/supply_crate`。
- [x] 回归验证：`npm run build`、`npm run test:game` 通过；截图显示基地和地表风格已明显改变。

### 下一步
- [ ] 自动下载第二包（`moderninteriors`），补“店铺室内柜台/设备/UI牌匾”细节，减少当前墙面重复感。
- [ ] 自动下载角色包（赛博角色），替换 `companion/zombie/runner/tank/merchant` 统一美术风格。
- [ ] 给 `itch_assets.mjs` 增加 `fetch-pack` 子命令，彻底把“页面解析+下载+解压”一键化。

## 最新进展（2026-02-09 凌晨：美术分层修复与防误覆盖）
- [x] 回退高风险素材覆盖：移除 `player` 与四个 `zone_*` 的外部覆盖，恢复角色比例与地表可读性。
  - 文件：`src/data/assetOverrides.ts`、`assets/itch/asset-overrides.json`
- [x] 素材导入脚本加“核心键保护”：默认禁止覆盖角色/敌人/地表核心贴图，需显式 `--allow-protected true` 才允许。
  - 文件：`scripts/itch_assets.mjs`
- [x] 背景分层改造：新增整图底图 `world_base_map`（2000x1500）并作为游戏最底层，统一世界氛围后再叠加基地与装饰。
  - 文件：`src/scenes/BootScene.ts`、`src/scenes/GameScene.ts`
- [x] 角色精灵重绘：重绘 `player`、`companion` 的像素写实轮廓，修复“只剩头部”观感。
  - 文件：`src/scenes/BootScene.ts`
- [x] 子弹素材分型：新增 `bullet_scatter/pulse/flame/pierce/cannon/frost/chain`，并接线主武器与 VS 武器自动选贴图。
  - 文件：`src/scenes/BootScene.ts`、`src/systems/WeaponSystem.ts`、`src/scenes/GameScene.ts`
- [x] 地图装饰密度下调：减少背景装饰刷屏数量，提升视觉聚焦。
  - 文件：`src/scenes/GameScene.ts`
- [x] 构建与截图验证：`npm run build`、`npm run test:game` 均通过，最新截图已恢复可读。

### 下一步（按你要求顺序）
- [ ] 只替换“角色包”：玩家/敌人/伙伴三套统一风格，先不动建筑。
- [ ] 再替换“子弹与特效”高对比素材，逐武器回归确认。
- [ ] 最后才进“建筑与物品”精修，避免再出现全局混乱。

## 最新进展（2026-02-09 凌晨：下载素材真实接入）
- [x] 通过 itch 下载并解压免费角色包：`Tiny RPG Character Asset Pack v1.03b -Free Soldier&Orc.zip`，落地到：
  - `/Users/fengnian/my-game/assets/itch/extracted/zerie-tiny-rpg/`
- [x] 新增素材适配脚本：
  - `/Users/fengnian/my-game/scripts/adapt_itch_assets.py`
  - 功能：把下载包中的 Soldier/Orc 帧裁切并生成可直接用于游戏的 `player/companion/zombie/runner/tank`，并从 Cainos 贴图生成 `wall/gate/reinforced_wall` 与变体，以及 `world_base_map`。
- [x] 生成并写入第三方素材目录：
  - `/Users/fengnian/my-game/public/assets/third_party/itch-adapted/`
- [x] 覆盖表恢复并生效（不再是空数组）：
  - `/Users/fengnian/my-game/assets/itch/asset-overrides.json`
  - `/Users/fengnian/my-game/src/data/assetOverrides.ts`
- [x] 当前已用下载素材覆盖 key（17项）：
  - `player, companion, zombie, runner, tank`
  - `wall, wall_v2, wall_v3`
  - `reinforced_wall, reinforced_wall_v2, reinforced_wall_v3`
  - `gate, gate_v2, gate_v3`
  - `store_counter, workbench, world_base_map`
- [x] 角色可视放大（避免过小）：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`（player scale）
  - `/Users/fengnian/my-game/src/systems/CompanionSystem.ts`（companion scale）
  - `/Users/fengnian/my-game/src/systems/EnemySystem.ts`（enemy scale）
- [x] 构建与自动截图验证通过：
  - `npm run build`
  - `npm run test:game`
  - 截图：`/Users/fengnian/my-game/output/web-game/shot-0.png`

### 下阶段重点
- [ ] 将角色从“静态单帧”升级为 4 向行走/攻击动画（当前只使用单帧，动作表现不足）。
- [ ] 按你要求继续：先完成“背景大底图+角色+敌人+伙伴+子弹”统一风格，再做建筑与道具精修。
- [ ] 把当前墙体模块改为“更完整的大段建筑块”（减少重复感），并补中文招牌与店内功能区图标。

## 最新进展（2026-02-09 清晨）
- [x] 炮塔自动成长系统：新增“按击杀自动升级（无上限）”链路。
  - 每个炮塔独立记录 `killCount/level/nextLevelKills`。
  - 升级阈值采用递增公式：`6 + level^1.22 * 3.2`（伙伴）与 `8 + level^1.25 * 4.5`（炮塔）。
  - 升级后自动应用数值曲线：伤害递增、射速提升（间隔下降）、射程提升。
  - 炮塔子弹颜色按循环色盘轮换，炮塔外观同步换色。
- [x] 伙伴自动成长系统：同样接入“按击杀自动升级（无上限）”。
  - 伙伴子弹打死敌人后会回传 ownerId，驱动该伙伴升级。
  - 升级后更新伙伴伤害/射速/射程与子弹伤害，并按循环色盘换色。
  - 升级提示浮字：`<伙伴名> 升级 Lv.X`。
- [x] 击杀来源打通：`GameScene.damageEnemy -> onEnemyKilled` 现在携带来源（玩家/伙伴/炮塔），用于正确归属经验成长。
- [x] 子弹 owner 元数据补齐并清理：伙伴/炮塔子弹写入 `ownerType/ownerId`，回收时清空，避免对象池污染。
- [x] 编译验证：`npm run build` 通过。
- [ ] 自动化长时回归受“升级卡片弹窗”影响，夜战纯自动脚本不稳定；建议加一条测试动作固定点击首卡后再长跑，专测炮塔/伙伴等级提升浮字与颜色轮换。

## 最新进展（2026-02-09 深夜美术收口）
- [x] 玩家体感尺寸修正：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 玩家 `setScale` 从 `2.2` 调整到 `2.75`，并同步调整碰撞体 `setSize(18,22)/setOffset(7,10)`，避免“看起来还是很小”与碰撞错位。
- [x] 子弹视觉优化（素材+运行时双改）：
  - `/Users/fengnian/my-game/scripts/adapt_itch_assets.py`
  - 重做 `bullet*` 贴图生成：增加外圈光晕、前端高光、尾迹，提升夜战可读性。
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - `getVSBulletScale` 全系上调，保证弹幕体感更明显。
- [x] 世界底图重制为“单张主图风格”：
  - `/Users/fengnian/my-game/scripts/adapt_itch_assets.py`
  - 重做 `world_base_map.png` 生成：
    - 减少脏噪点与大块脏斑（降低数量与透明度）
    - 道路改为更干净的车道结构（主路、肩线、虚线）
    - 区域色调统一，保留大图完整感，不再依赖明显方块拼接观感。
- [x] 素材再生成与验证：
  - `/tmp/mygame-venv/bin/python /Users/fengnian/my-game/scripts/adapt_itch_assets.py`
  - `npm run build` 通过
  - `npm run test:game` 通过（Chrome for Testing，截图输出到 `output/web-game/shot-0.png`）

## 最新进展（2026-02-09 P0收敛）
- [x] 编译阻塞修复：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 移除未使用的 `baseResidentSpots` 字段与旧赋值段，`npm run build` 恢复通过。
- [x] 玩家体型与碰撞再校准：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 玩家 `setScale` 调整为 `3.25`，并同步碰撞盒 `setSize(16,20)/setOffset(8,8)`，与当前导入角色素材匹配。
- [x] 建筑受击可观测性增强（用于验证敌人攻塔/攻墙）：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - `render_game_to_text` 增加 `structures` 字段（墙/炮塔数量、最低耐久）。
- [x] 敌人攻塔优先级修正：
  - `/Users/fengnian/my-game/src/systems/EnemySystem.ts`
  - 去除“仅 420 范围内才优先炮塔”的限制，改为在给定搜索半径内优先炮塔目标。
- [x] 自动化验证通过（Chrome for Testing）：
  - `npm run test:game` 成功产出：
    - `/Users/fengnian/my-game/output/web-game/shot-0.png`
    - `/Users/fengnian/my-game/output/web-game/state-0.json`
    - `/Users/fengnian/my-game/output/web-game/errors-0.json`
  - 长跑状态样例：`structures.minWallHealth` 已从满血下降（示例：68/84），证明夜晚敌人确实对建筑造成伤害。

## 最新进展（2026-02-09 建造面板点击修复）
- [x] 修复固定建造菜单“点不到/切换栏目无效/点击穿透”问题：
  - `/Users/fengnian/my-game/src/ui/BuildPanel.ts`
  - 新增面板手动命中判定兜底（tab/card/close），避免不同场景层级下 Phaser 子节点命中丢失。
  - 新增 `tabHotzones/cardHotzones`，标签与卡片支持大命中框。
  - 面板打开时注册、关闭时注销 `pointerdown` 监听，避免残留监听与状态污染。
- [x] 场景侧防穿透补强：
  - `/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 建造模式下，若点击落在面板屏幕区域，直接拦截，不触发世界放置。
- [x] 调试状态增强：
  - `render_game_to_text` 新增 `build.selectedCategory/panelOpen`，可自动回归判断栏目切换结果。
- [x] 自动化回归通过：
  - 连续点击多个栏目后状态变更为 `selectedCategory: "special"`（证明栏目切换已生效）。

## 最新进展（2026-02-09 素材适配回归）
- [x] 接入 `temp/Pixel Crawler - Free Pack` 到素材生成链路（`scripts/adapt_itch_assets.py`）。
- [x] 主角/伙伴彻底分离：
  - 玩家使用 `Knight Idle` 帧作为 `player.png` 来源。
  - 伙伴使用 `Rogue Idle` 帧作为 `companion.png` 来源并做轻微色调区分。
  - 解决此前 `player.png` 与 `companion.png` 像素完全一致的问题。
- [x] 敌人来源增强：
  - `zombie` 由 `Wizzard Idle` 改色生成。
  - `runner` 由 `Rogue Run` 帧改色生成。
  - `tank` 继续使用较大体型来源并保留高威胁轮廓。
- [x] 子弹素材来源切换：优先从 `Pixel Crawler/Weapons/Hands/Hands.png` 三帧生成多类型子弹贴图（`bullet_*`），不再仅依赖旧箭矢切片。
- [x] 主角尺寸上调：`GameScene` 中玩家缩放调整到 `4.15`，同步碰撞盒到 `20x26`，体感更明显。
- [x] 世界底图重绘策略修正：`world_base_map` 改为“单图平滑分区 + 软混合 + 低强度颗粒 + 中心可读性增强”，减少硬方块拼接感。
- [x] 验证通过：`npm run build` 与 `npm run test:game` 成功，截图输出 `output/web-game/shot-0.png`。

### 仍待继续
- [ ] 继续把 `Pixel Crawler` 的环境结构（`Environment/Structures/Buildings/*.png`）做系统切片映射，替换当前基地内部部分旧组合件。
- [ ] 增加主角专属动画帧切换（Idle/Run），当前仍是单帧精灵。
- [ ] 修复 favicon 404（非功能阻塞）。

## 最新进展（2026-02-09 夜间P0回归）
- [x] `B` 键链路加固：优先打开/关闭右侧 `制造工坊` 可点击面板，不再回退到旧滚轮建造逻辑；`state-0.json` 已验证 `panelOpen:true`。
- [x] 玩家体型与碰撞体再次校准：主角放大到 `3.15`，碰撞盒同步调整，避免“主角仍偏小”的观感。
- [x] 炮塔/城墙受击压强提升：`enemyDamageBuilding` 伤害倍率提高，攻击间隔缩短；`EnemySystem` 攻城触发距离与频率上调。
- [x] 血月Boss压强上调：Boss生命/伤害/速度按血月与周次叠乘，二次Boss进一步增强。
- [x] 子弹观感增强：`WeaponSystem` 子弹默认 ADD 混合并提高亮度，提升弹幕可见度。
- [x] 回归验证：`npm run build` + `npm run test:game` 通过，自动截图显示 `B` 面板可见且栏目可点。

### 下一步建议（P1）
- [ ] 将白天“钓鱼/做饭/站岗/睡觉”行为接入真实产出增量（当前已可视化，收益仍主要来自日结算模型）。
- [ ] 给Boss新增专属地面AOE技能与预警圈，进一步拉开夜战压强。
- [ ] 子弹新增拖尾贴图帧动画（而不只混合模式）以提升“炫酷感”。

## 2026-02-09 夜间回归修复（B菜单/建造列表/体型）
- 修复：`B` 改为建造专用工坊模式（不再混入武器/弹药空页）。
- 修复：建造分类新增`全部`，且分类点击优先级提升，避免点到背景。
- 新增可建造设施：`宿舍房间`、`双层床位`、`哨岗`、`炊事台`。
- 修复：主角改为基于素材原高的自适应缩放并下调碰撞体，恢复过门能力。
- 验证：`npm run build --silent`通过；`npm run test:game`通过；Playwright实测`B`菜单可打开并切换分类、可选中建造。
- 仍待继续：白天生活行为增加“实体去钓鱼点/巡逻路线/睡床位占用”的更强可视化；建造页可加入滚动与搜索；补`favicon`避免控制台404噪音。

## 2026-02-09 深夜收尾（玩家强度三档 + 升级卡DPS预览）
- [x] 玩家强度三档实装（前期爽 / 中期稳 / 后期极限）：
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 新增 `getPowerTierProfile()` 与 `updatePowerTierState()`，按 `等级+周次+击杀数` 自动切档并提示。
  - 三档会联动伤害、攻速、弹速、额外弹丸、穿透层数，并与 Overdrive 叠加。
- [x] 升级卡强度预览（选卡可见 DPS 变化）：
  - 文件：`/Users/fengnian/my-game/src/systems/EvolutionSystem.ts`
  - `LevelUpChoice` 增加 `previewDpsBefore/After/Delta/previewTextCN`。
  - 生成选项后对每张卡做“模拟应用 -> 估算DPS -> 显示增减值”。
  - 文案示例：`强度预览 DPS 123.4 → 158.7 (+35.3)`。
- [x] 升级面板展示接线：
  - 文件：`/Users/fengnian/my-game/src/ui/LevelUpPanel.ts`
  - 卡片高度上调并增加底部预览文本，增幅为绿色、减幅为红色。
  - 修复动画元素类型导致的 TS 报错，确保构建通过。
- [x] 战斗成长曲线补强（配合三档体感）：
  - 文件：`/Users/fengnian/my-game/src/systems/WeaponSystem.ts`
  - 提高武器等级成长、子弹数量阈值收益、进化后增益。
  - 文件：`/Users/fengnian/my-game/src/data/weapons.ts`
  - 强化早中期基础武器数值，减轻“前期刮痧”。
- [x] 验证：
  - `npm run build` 通过。
  - `npm run test:game` 通过（截图输出：`/Users/fengnian/my-game/output/web-game/shot-0.png`）。

## 最新进展（2026-02-14：基地管理面板可视与滚动修复）
- [x] 修复 `T` 基地管理面板“有人数但列表空白”问题：
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
  - 重构伙伴列表渲染，移除易失效遮罩链路，改为可见区容器+按滚动偏移显示行，避免卡片被整体裁掉。
- [x] 基地伙伴列表滚动能力重做：
  - 新增明确滚动轨道与滚动块（右侧可见滚动轴），支持鼠标滚轮与拖动滚动。
  - 修复滚动事件清理（wheel/pointermove/pointerup 监听释放），避免面板反复开关后输入残留。
- [x] 伙伴卡信息密度与可读性提升：
  - 卡片新增战斗摘要（攻/血/程/速），保留人格标签、签名技能/岗位推荐。
  - 行内操作按钮（出战/驻守、岗位切换、详情）提高点击优先级，避免被滚动捕获层吞掉。
- [x] 验证：
  - `npm run build` 通过。
  - `npm run test:game` 通过（基础回归）。
  - Playwright 目测回归：`T` 面板在“0伙伴”状态下信息正常；历史“有人数但空白”根因链路已移除。

### 待继续
- [ ] 在实机含多伙伴存档下补一轮“滚动到底 + 最后一名伙伴可点击切换状态/岗位”的录像式回归（当前自动化脚本缺少直接注入伙伴动作）。
- [ ] 视用户提供的参考游戏截图继续做视觉对齐（卡片排版、色板、图标风格）。

## 最新修复（2026-02-14：T面板伙伴名单有数量但列表空白）
- [x] 根因修复：兼容旧/异常伙伴档案数据（`profile` 缺字段）导致的渲染中断。
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
  - `BasePanel` 新增 `ensureRenderableProfile/normalizeProfile/getSafeCompanionName`，对 `gender/age/profession/personality/traits/hobbies/signatureSkill/background` 全字段兜底。
  - 列表卡片渲染与详情档案渲染改为使用归一化后的 profile，避免 `undefined.length` 等异常把整张列表“渲染到一半直接中断”。
  - 关系摘要和属性计算增加容错，单个伙伴数据异常不再拖垮整面板。
- [x] 验证：
  - `npm run build` 通过。
  - `npm run test:game` 通过。

### 待用户实机确认
- [ ] 在已有老存档（出现“伙伴名单(2)但无卡片”）下按 `T` 复测：应能看到伙伴卡片与详情，不再只有标题。

## 最新进展（2026-02-14：伙伴/炮塔升级-转职与Boss回归）
- [x] 伙伴击杀升级扩展到 Lv.40：
  - 文件：`/Users/fengnian/my-game/src/systems/CompanionSystem.ts`
  - 新增 `COMPANION_PROMOTION_LEVEL=20`、`COMPANION_MAX_LEVEL=40`，击杀升级曲线在 20 级后显著抬升。
  - `registerKill()` 支持 20 级自动随机转职（按角色池），并在 40 级封顶。
  - 进阶职业会叠加伤害/射速/射程/血量/移速与弹道特性（穿透/爆炸/追踪）加成。
- [x] 炮塔击杀升级扩展到 Lv.40：
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 新增 `TURRET_PROMOTION_LEVEL=20`、`TURRET_MAX_LEVEL=40` 与随机进阶炮塔职业池。
  - 炮塔 20 级自动随机转职，40 级封顶；20级后击杀需求显著提升。
  - 转职后同步提升伤害/射速/射程/弹速，并更新炮塔颜色与提示文本。
- [x] 夜间“扎堆”分散防守优化：
  - 文件：`/Users/fengnian/my-game/src/systems/CompanionSystem.ts`、`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 出战伙伴改为夜间环形编队锚点跟随，减少贴脸堆叠。
  - 驻守伙伴夜间防卫锚点扩展为基地周界+岗哨优先，覆盖更多站位点。
- [x] Boss 系统链路修复：
  - 文件：`/Users/fengnian/my-game/src/systems/EnemySystem.ts`、`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - Boss UI 在“有Boss时创建/更新、无Boss时清理”逻辑补全。
  - Boss 击杀路径统一交由 `enemySystem.onBossKilled()`，避免重复销毁与状态残留。
- [x] T面板显示增强跟进：
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
  - 伙伴卡显示 `Lv./40` 与进阶职业标识；详情面板显示进阶职业信息。

### 本轮验证
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过。
- [x] Playwright 实机回归：
  - `T` 面板可正常打开并显示基础信息（无伙伴场景）。
  - 强制血月测试后 `render_game_to_text` 可观察到 `bosses: 1`（Boss链路存在且无新报错）。
  - 控制台仅剩 `favicon.ico 404` 噪音，不影响玩法。

### 待继续
- [ ] 在“高人数伙伴存档”下补一轮实机录像式回归：滚动到底并操作最后一名伙伴（驻守/出战/岗位切换）。
- [ ] 继续按用户给的参考图做视觉同风格改造（基地管理信息分区、头像/标签密度、详情层级）。

## 最新进展（2026-02-14：白天地图生态与人口上限）
- [x] 地图生态区扩展（河流/森林/城区/山洞）
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 新增世界探索层 `createExplorationWorld()`：
    - 河流带（水面/涟漪）
    - 森林区（树木密布）
    - 城区废墟（破败民宅/小店）
    - 山洞入口与洞穴区
- [x] 白天探索交互实装（E键）
  - 新增探索点类型：钓鱼、游泳、打猎、搜刮、山洞探险。
  - 交互提示接入现有 `E` 系统，支持冷却、每日次数、昼夜限制。
  - 区域强约束：
    - 仅河流：钓鱼/游泳
    - 仅森林：打猎
    - 仅城区：搜刮药品与物资
    - 仅山洞：探险
  - 奖励包含资源与经验，附带风险（受伤/触发敌人增援），提升白天生存决策压力。
- [x] 人口上限系统
  - 文件：`/Users/fengnian/my-game/src/systems/BaseSystem.ts`
  - 新增人口容量计算：
    - 基础容量 `2`
    - `room_quarters` 提供主要人口扩容（随层级增加）
    - `bunk_bed` 提供床位扩容（随层级增加）
  - 新增 `getPopulationCapacity/getPopulationUsage/canRecruitCompanion`。
- [x] 招募受人口限制
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 救援幸存者时若人口已满：禁止招募，并给出“先建宿舍/床位”的明确提示。
- [x] UI 同步人口上限
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
    - 基地管理面板显示 `当前人口/人口上限`，满员高亮警告。
    - 伙伴等级进度条修正为 `Lv.40` 体系（进度按 40 级计算）。
  - 文件：`/Users/fengnian/my-game/src/scenes/UIScene.ts`
    - 右侧团队状态显示改为 `人数/上限`。
- [x] 测试状态
  - `npm run build` 通过。
  - `npm run test:game` 通过。
  - `render_game_to_text` 已新增 `player.zone` 与 `population.used/cap` 供自动化验证。

### 待继续
- [ ] 增加“探索动画/小事件链”进一步贴近参考游戏节奏（例如洞穴分层事件、城区多房间搜刮）。
- [ ] 为探索点补更细致的UI面板（掉落预期、风险等级、今日剩余次数）。

## 最新进展（2026-02-14：白天点位伙伴执行强化 + 夜防分散稳定）
- [x] 白天探索点位改为“可视化执行状态 + 反扎堆分流”
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 每个探索点新增状态文本（执行中人数 / 今日已用次数 / 上限）。
  - 新增探索调度逻辑：优先派往当前人数更少且未达日上限的点位。
  - 行为优先级强化：`钓鱼/拾荒/探险` 会优先走外部探索点而非只在基地内循环。
  - `E` 提示文案改为实时显示：该点“正在执行人数 + 今日进度”。
- [x] 夜间防御站位稳定分散
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 新增按 `companionId` 计算的稳定偏移，夜防不再每次随机抖动落位。
  - 岗哨位与普通周界位使用不同偏移范围，减少同点重叠与视觉扎堆。
- [x] 基地管理详情卡信息修正
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
  - 去掉伙伴详情中重复“技能”行，替换为“驻守岗位 / 出战状态”行，信息更清晰。
- [x] 调试观测增强（便于持续自检）
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - `render_game_to_text` 新增：
    - `companions.party/base/nightDefenders`
    - `exploration[]`（每个点位 active/used/limit）

### 本轮自检
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过。
- [x] Playwright 实机验证：
  - 注入 10 名驻守伙伴后，白天探索点出现分流执行（多个点位 `active > 0`，资源增长显著）。
  - 强制血月后立即状态：`isNight=true`、`nightDefenders=10`、`bosses=1`，说明夜防与 Boss 链路可触发。

## 最新进展（2026-02-14：完整性检查 + Roguelike词缀回合）
- [x] 回合词缀（Run Mutators）系统落地
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 每局开局随机抽取2条词缀（如：狂战协议/拾荒热潮/夜巡法令/紧缩配给/炮塔超频）。
  - 词缀效果接入战斗与经济核心链路：
    - 玩家/伙伴/炮塔伤害倍率
    - 受击伤害倍率
    - 敌方“耐久倍率”
    - 掉落倍率与白天活动产出倍率
    - 每日额外食物消耗倍率
    - 经验倍率（通过 `baseStats.xpMultiplier`）
  - 开局与每日总结会提示本局词缀，强化“每局不同”的 roguelike 体感。
- [x] 掉落系统支持倍率参数
  - 文件：`/Users/fengnian/my-game/src/systems/LootSystem.ts`
  - `spawnLoot` 新增 `gainMultiplier`，并同步影响：
    - lootTable资源数量
    - 随机额外掉落数量
    - fallback保底掉落数量
- [x] 完整性清理：favicon 404 噪音修复
  - 文件：`/Users/fengnian/my-game/index.html`
  - 文件：`/Users/fengnian/my-game/public/favicon.svg`
  - 自动化日志已无控制台错误。

### 本轮完整性自检
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过，`errors-0.json = []`。
- [x] 多次自动开局验证词缀随机性（`state-0.json` 与 `state-1.json` 词缀不同）。
- [x] 实机注入驻守伙伴后，夜间 `nightDefenders` 正常，白天探索进度与产出仍持续生效。

## 最新进展（2026-02-15：Roguelike事件层上线）
- [x] 白天/夜晚随机事件二选一系统（高风险高收益）
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 新增事件池：
    - 白天：`流动商队信号`、`废弃诊所`
    - 夜晚：`周界破口`、`异常讯号追踪`
  - 每个事件提供 2 个选项（稳健/高风险），选项可产生：
    - 资源收益（含能量核/比特币）
    - 经验与治疗
    - 自伤惩罚
    - 额外敌袭
- [x] 与词缀联动
  - 事件面板显示词缀影响系数：`奖励倍率`、`风险倍率`。
  - 事件结算按当前词缀动态放大收益或风险（与已有 run mutator 参数统一）。
- [x] 夜间事件与波次链路衔接
  - 夜间事件触发时，夜晚波次延后到事件决策后再启动，避免流程冲突。
- [x] 自动兜底防卡死
  - 事件面板 12 秒无人操作自动随机选择，防挂机/自动化卡死。
  - 增加调试入口 `__debug_trigger_run_event(period)` 便于回归验证。
- [x] 调试观测增强
  - `render_game_to_text` 新增 `runEvent.open/pendingNightWaveStart`。

### 本轮验证
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过（控制台错误为空）。
- [x] 长时自动回归（5200帧）覆盖日夜循环。
- [x] Playwright 手工验证：
  - 强制触发夜间事件后 `runEvent.open=true`。
  - 13 秒后自动决策生效，`runEvent.open=false`，流程继续推进。

## 最新进展（2026-02-15：局外成长层-永久天赋树分支化）
- [x] 永久天赋树数据模型落地（三分支）
  - 文件：`/Users/fengnian/my-game/src/state/GameState.ts`
  - 新增 `permanentTalents` 持久字段（9节点）：
    - 炮塔流：`turret_core` / `turret_matrix` / `turret_fortress`
    - 伙伴流：`companion_drill` / `companion_link` / `companion_command`
    - 经济流：`economy_salvage` / `economy_logistics` / `economy_fund`
  - 新增存档迁移与默认值回填（旧档自动补全 `permanentTalents`）。
  - 新增 API：
    - `getPermanentTalentChoices()`：每个分支给出当前可升级节点
    - `applyPermanentTalentChoice(nodeId)`：升级并持久化
    - `getPermanentTalentBonuses()`：统一输出本局生效倍率
- [x] 结算界面改为“天赋树节点三选一”
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 游戏结束页从旧“damage/vitality/mobility”改为三分支节点卡片：
    - 显示：分支、节点名、`Lv.N -> Lv.N+1/Max`、节点描述
    - 选择后锁定并提示升级结果
    - 若全部满级，允许直接重生并提示“永久天赋已全部满级”
- [x] 永久天赋接入战斗/经营主循环
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 文件：`/Users/fengnian/my-game/src/systems/CompanionSystem.ts`
  - 文件：`/Users/fengnian/my-game/src/systems/BaseSystem.ts`
  - 接入内容：
    - 炮塔流：伤害（经 run mutator 统一叠乘）、射速、耐久
    - 伙伴流：伤害（run mutator 叠乘）、射速、白天产出
    - 经济流：掉落倍率、白天收益倍率、食物消耗下降、比特币结算提升
  - `render_game_to_text` 新增 `permanentTalents.levels/bonuses`，便于自动化观测。
- [x] 比特币结算改为支持永久经济天赋
  - 文件：`/Users/fengnian/my-game/src/state/GameState.ts`
  - `bankRunBitcoin()` 现在按 `economy_fund` 提升后的倍率入账。

### 本轮验证
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过（`errors-0.json = []`）。
- [x] Playwright 运行时验证：
  - 在 `localStorage.emergence_save` 注入天赋等级后开局，`render_game_to_text` 中 `permanentTalents.bonuses` 与预期一致。
  - `mutatorEffects` 中可见天赋联动后的倍率（如 `lootGainMul/dayActivityGainMul/dayFoodConsumptionMul` 已叠加天赋）。

## 最新修复（2026-02-15：随机事件弹窗点击失效）
- [x] 修复随机事件弹窗出现后鼠标无法选择问题
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - 事件弹窗开启时，临时禁用 `UIScene` 输入；事件结束后自动恢复，避免 UI 场景抢占指针。
  - 增加弹窗遮罩 `pointerdown` 阻断，防止点击穿透到底层玩法。
  - 增加全局 `pointerdown` 防护：`runEventOpen` 时不再响应建造放置点击。
- [x] 验证
  - `npm run build` 通过。
  - `npm run test:game` 通过。
  - Playwright 手工回归：强制触发 `__debug_trigger_run_event('day')` 后，鼠标点击事件卡片可成功结算并关闭弹窗（`runEvent.open: true -> false`）。

## 最新进展（2026-02-15：战斗爽感与难度提升）
- [x] 子弹系统加入“武器签名弹幕”
  - 文件：`/Users/fengnian/my-game/src/systems/WeaponSystem.ts`
  - 新增 `weaponShotCounter` 与周期触发模式，不同武器会追加专属弹幕：
    - 基础激光：周期触发链式三连散射
    - 散射光波：周期触发大扇面灼烧弹
    - 脉冲连射：周期触发穿透三连针
    - 烈焰射线：周期触发高密火墙扇面
    - 穿透光束：周期触发棱镜分裂
    - 能量炮：周期触发集束爆裂
  - 这些弹幕走现有子弹池/特效链路，包含贴图、伤害、射程、速度的独立调制，视觉与手感显著区别。
- [x] 敌人整体强度上调（不再“薄皮纸”）
  - 文件：`/Users/fengnian/my-game/src/systems/WaveSystem.ts`
  - 提高每波敌人数基线、血月波次数量放大系数。
  - 缩短刷怪间隔上下限，压力更连续。
  - 为每个敌人引入“波次+周次+天数+血月”综合系数，统一抬升生命/伤害/速度。
- [x] Boss 防秒杀机制 + 狂暴强化
  - 文件：`/Users/fengnian/my-game/src/systems/WaveSystem.ts`
  - 文件：`/Users/fengnian/my-game/src/systems/EnemySystem.ts`
  - 文件：`/Users/fengnian/my-game/src/scenes/GameScene.ts`
  - Boss 生成时大幅上调生命/伤害/速度，并写入 `bossArmorMul / bossHitCapRatio / enrageThreshold`。
  - 伤害结算对 Boss 增加抗性与单次伤害上限，抑制极端爆发秒杀。
  - Boss 低血触发狂暴（攻速/机动/技能频率提升），特殊攻击伤害按 Boss 当前强度动态计算。

### 本轮验证
- [x] `npm run build` 通过。
- [x] `npm run test:game` 通过（`errors-0.json = []`）。

## 最新进展（2026-02-15：移动端基地面板可读性修复）
- [x] 修复 `T` 基地管理面板“文字像蚊子、信息挤成团”的移动端问题
  - 文件：`/Users/fengnian/my-game/src/ui/Panels.ts`
  - `BasePanel` 新增移动端可读性策略：
    - 字号缩放改为优先读取真实 canvas 显示宽度（`getBoundingClientRect().width`），不再只依赖内部宽度。
    - 竖屏移动端设定最小字体放大系数，避免在高内部分辨率下字体不放大。
    - 调整布局缩放系数，避免“字号放大但间距也失控”导致重叠。
  - 伙伴列表卡片重做（移动端竖屏）：
    - 卡片高度提升、头像与主信息区间距加大。
    - 标签数量收敛（最多 2 个）并重排，减少拥挤。
    - 状态/岗位按钮尺寸加大，触控更稳。
    - 保留滚动轴与拖动滚动行为。
  - 字体栈升级为中文优先（`PingFang SC / 微软雅黑 / Noto Sans SC` 等），提升中文清晰度与观感。
- [x] 验证
  - `npm run build` 通过。
  - Playwright 手机视口（390x844）实测：进入游戏后 `T` 面板在 10 名伙伴场景下可读性明显提升，滚动正常。
  - 控制台 `error` 级别日志为 0。

### 待继续
- [ ] 统一其余 UI（HUD/任务/商店）的中文字体栈与移动端字号策略，避免面板之间清晰度不一致。
- [ ] 为移动端增加“简洁/详细”列表开关，兼顾信息量与大字体可读性。

## 最新修复（2026-02-15：竖屏缩放再次回退问题）
- [x] 修复“切到竖屏后画面等比缩小/沿用横屏舞台”的问题
  - 文件：`/Users/fengnian/my-game/src/main.ts`
  - 根因：此前仅在“首次识别为 mobile”时挂载 resize 逻辑；桌面端后续改窗口比例不会触发舞台切换。
  - 修复：改为所有设备统一监听 `resize/orientationchange/visualViewport.resize`，每次按当前视口实时选择舞台比例并 `setGameSize + refresh`。
  - 新增菜单重建：舞台宽高变化时若 `MenuScene` 正在激活，自动 `scene.restart()`，避免旧布局残留导致上下留白/元素错位。
- [x] 增加“宽竖屏”舞台档位
  - 新增 `900x1600` 作为宽竖屏适配（约 9:16）。
  - 规则：竖屏且 `vw/vh >= 0.52` 时使用宽竖屏档位；其他竖屏继续使用 `720x1560`（常规手机比例）。
  - 结果：像 `486x869` 这类桌面竖窗不再出现明显“被缩小”的留黑感。
- [x] 验证
  - `npm run build` 通过。
  - Playwright 回归：
    - 1366x768 -> 486x869：Canvas `1280x720 -> 900x1600`，CSS 尺寸约 `486x864`，基本铺满竖屏。
    - 486x869 -> 1366x768：Canvas 恢复 `1280x720`，横屏菜单恢复正常。

## 最新修复（2026-02-15：战利品仓库面板文字过小）
- [x] 修复 `GearVaultPanel` 文字“蚊子字”问题（标题外，词条/描述/按钮全部放大）
  - 文件：`/Users/fengnian/my-game/src/ui/GearVaultPanel.ts`
  - 改动要点：
    - 新增面板级字号/布局缩放系统（`fontBoost/layoutBoost/fs/unit`）。
    - 加入中文优先字体栈（PingFang/微软雅黑/Noto Sans SC），改善中文可读性。
    - 提升整体字体下限（最小字号门槛上调），避免细节说明文字过小。
    - 仓库列表改为更大行高与更清晰的按钮区（装备/出售），减少文字拥挤。
    - 头像装备位展示区域加高，槽位文本与属性行上调字号。
    - 比特币强化区文本与购买按钮同步放大。
- [x] 验证
  - `npm run build` 通过。
  - Playwright 实测（1180x700）打开 `V` 面板，标题/槽位/强化描述的可读性明显提升。

## 2026-02-15 竖屏整体放大 + 建造/基地字体二次放大

### 本轮目标
- 建造菜单字体继续放大
- 基地(T)面板字体继续放大
- 竖屏模式下整体画面继续放大，避免“看起来像等比缩小”

### 代码改动
- `src/main.ts`
  - 竖屏舞台分辨率下调（同纵横比，提升屏幕内视觉尺寸）：
    - `STAGE_MOBILE_PORTRAIT`: `640x1386 -> 560x1212`
    - `STAGE_MOBILE_PORTRAIT_WIDE`: `720x1280 -> 640x1138`
- `src/scenes/GameScene.ts`
  - 竖屏相机缩放增强：
    - `portraitZoom`: `1.24/1.18 -> 1.32/1.26`
    - 移动横屏从 `0.94 -> 0.98`
  - 建造模式浮动提示框（Build Palette）进一步放大：
    - 面板尺寸增大（竖屏 `panelW/H` 提升）
    - 文本字号：竖屏 `20px`，移动横屏 `15px`，桌面 `13px`
- `src/ui/Panels.ts`
  - `CraftingPanel`
    - 竖屏字体放大底线：`1.95 -> 2.15`
    - clamp：`1.05..2.5 -> 1.15..2.75`
    - 全局最小字号：`竖屏13/桌面11 -> 竖屏14/桌面12`
  - `BasePanel`
    - 竖屏字体放大底线：`2.05 -> 2.25`
    - clamp：`1.1..2.6 -> 1.2..2.85`
    - 列表与详情卡最小字号：`竖屏13/桌面11 -> 竖屏14/桌面12`

### 编译与验收
- `npm run build` 通过。
- Playwright 实测（486x869 竖屏）：
  - 主场景：`page-2026-02-15T12-04-20-937Z.png`（整体明显放大）
  - B建造菜单：`page-2026-02-15T12-05-12-963Z.png`（标题/条目字号增大）
  - T基地面板：`page-2026-02-15T12-06-03-238Z.png`（标题/摘要/名单字号增大）
- 控制台 error：0 条。

### 备注
- `develop-web-game` 客户端脚本已执行；其 canvas 导出截图在本项目上出现全黑（`output/web-game/shot-0.png`），但 MCP Playwright 的页面截图正常可视，故以可视截图验收为准。

## 2026-02-15 地图点位标记文字放大（河流/森林/城区/山洞）

### 用户反馈
- 地图上的点位标记文字偏小（例如“森林”等标签）
- 需求：地图标记文字更大更清楚，并继续推进开发

### 本轮实现
- 文件：`src/scenes/GameScene.ts`
- 新增地图文字缩放能力：
  - `getUIFontFamily()`
  - `getWorldMarkerFontBoost()`（按设备与竖屏自适应）
  - `worldFs(base, min)`
- 新增世界区域标题：
  - `spawnWorldZoneLabel(...)`
  - 区域标签：`河流区 / 城区 / 森林区 / 山洞区`
- 重做探索点位文字样式（`spawnExplorationSpot`）：
  - 文字整体放大（点位名、状态文本、备用图标点）
  - 增加 `zoneTag`（河流/森林/城区/山洞）
  - 统一中文字体栈
  - 加粗描边 + 深色底板，提升复杂背景下可读性
  - 点位光环描边加粗，图标按字体倍率联动放大

### 验证
- `npm run build` 通过。
- Playwright 竖屏 486x869 实测截图：
  - `/var/folders/4q/r0173bt12td4vsg5_wvtpyrm0000gn/T/playwright-mcp-output/1771083715717/page-2026-02-15T12-19-05-222Z.png`
  - 可见“河流区”区域标题、点位名“河岸钓点/废墟民宅”等均已放大并加底板。

### 后续可继续开发（下一步）
- 给探索点增加“远距离地图箭头”与“屏幕边缘指示器”（不在视野内也能定位）
- 给点位状态增加图标化（可执行/已满/夜间封锁）
- 小地图同步显示四大区域名与探索点图标

## 2026-02-15 继续开发：探索点导航层（边缘指示 + 小地图点位）

### 使用技能
- `develop-web-game`：按“实现 -> Playwright验证 -> 截图检查 -> 控制台错误检查”流程迭代。
- `game-engineering-team`：按“可读性优先 + 移动端可用 + UI稳定性”策略实现。

### 新增功能

#### 1) 探索点屏幕边缘指示器（GameScene）
- 文件：`src/scenes/GameScene.ts`
- 新增内容：
  - `getZoneAccentColor(zone)`
  - `getCompactSpotLabel(name)`
  - `clearExplorationEdgeIndicators()`
  - `ensureExplorationEdgeIndicator(spot)`
  - `updateExplorationEdgeIndicators()`
- 行为：
  - 当探索点不在安全可视区域内时，在屏幕边缘显示带箭头的方向提示。
  - 箭头会旋转指向真实方向。
  - 夜晚会将指示器弱化（偏灰、透明度降低，带“封”提示）。
  - 近距离进入点位交互范围后自动隐藏，避免干扰。

#### 2) 小地图探索点图标（UIScene）
- 文件：`src/scenes/UIScene.ts`
- 在`updateMinimap()`中增加探索点绘制：
  - 按区域/点位颜色显示探索点。
  - 夜晚统一转灰，表达“封锁”语义。
  - 当前待交互点位加黄色圈强调。

### 数据结构补充
- `ExplorationSpot`增加`color: number`字段。
- 探索点创建时将`def.color`写入spot，供边缘指示和小地图复用。

### 稳定性处理
- 场景重置/关卡重开/scene shutdown时统一销毁边缘指示器，避免残留。
- `isGameOver`或`runEventOpen`时隐藏所有边缘指示器。

### 验证
- `npm run build`通过。
- Playwright竖屏(486x869)可视验证：
  - `page-2026-02-15T12-41-45-678Z.png` 可见边缘箭头+点位短标签。
  - 小地图出现探索点彩色点（夜间则灰化）。
- 浏览器console error：0。

### 备注
- `develop-web-game`脚本客户端在本项目仍表现为`render_game_to_text`停留menu状态（历史已知），因此本轮仍以MCP Playwright可视截图与console为验收主依据。

## 2026-02-15 移动端触控全面补齐（摇杆 + 功能按钮 + 关闭态）

### 用户需求
- 手机端没有虚拟摇杆，人物无法移动。
- 没有鼠标时，菜单难以打开/关闭。
- 需要移动端按钮：建造（含关闭态X）、伙伴、任务、交互、交易商人、眼镜店、仓库V。

### 本轮实现

#### 1) 玩家移动输入支持虚拟摇杆（`PlayerSystem`）
- 文件：`src/systems/PlayerSystem.ts`
- 增加 `virtualMove` 向量与 `setVirtualDirection(x, y)`。
- 在无键盘方向输入时，改用摇杆向量驱动移动。
- `setMovementEnabled(false)` 与 `reset()` 会清空虚拟输入，避免残留漂移。

#### 2) GameScene 接入移动事件（`GameScene`）
- 文件：`src/scenes/GameScene.ts`
- 监听：`mobile-move`、`mobile-interact`、`mobile-toggle-build`。
- `mobile-move` -> 转发到 `playerSystem.setVirtualDirection`。
- `mobile-interact` -> 复用 `handleInteraction()`，并支持设施内退出。
- `mobile-toggle-build` -> 复用建造开关逻辑。
- 场景 `shutdown` 时解除监听并清零移动向量。

#### 3) UIScene 新增移动端触控 HUD（`UIScene`）
- 文件：`src/scenes/UIScene.ts`
- 仅移动端创建触控层：
  - 左下：虚拟摇杆（支持拖拽、释放回中、持续发射 `mobile-move`）。
  - 右下：8 个操作按钮（2x4）
    - `建造` / `制造`
    - `伙伴` / `任务`
    - `交互E` / `交易`
    - `眼镜店` / `仓库V`
- 每个按钮有活动态 `×` 文案（如 `任务×`、`仓库×`），可作为“开关关闭”反馈。
- 增加移动端全局关闭 `✕`（带放大点击热区），并统一 `closeTopLayerForMobile()` 处理顶层关闭。
- 新增状态联动刷新（`BUILD_MODE_TOGGLED` + 周期刷新），保证按钮高亮与面板状态一致。
- 修复触控层点击优先级：为移动按钮/关闭区设置更高 `priorityID`，降低被面板背景拦截风险。

#### 4) 调试可观测性（`main.ts`）
- 文件：`src/main.ts`
- 暴露 `window.__phaserGame = game`，便于 Playwright/手动调试时读取场景与面板开关状态。

### 验证
- `npm run build` 多次通过。
- Playwright 竖屏（486x869）验证：
  - 摇杆拖拽后 `render_game_to_text.player.x` 从 `1000` 变为 `1147`，移动生效。
  - 按钮状态脚本验证（读取 `UIScene` 面板状态）：
    - `build / base / quest / exchange / shop / vault` 均可打开并再次点击关闭。
  - 控制台 error: 0。

### 备注
- 当“等级提升”面板处于开启状态时，移动端全局关闭 `✕` 会按设计忽略（避免跳过升级选择）。
- 普通菜单可通过“同名按钮再次点击（×态）”稳定关闭，符合无键鼠移动端闭环操作。

## 2026-02-18 第一批像素素材产出（主角+3僵尸）

### 需求
- 主角 + 3 种僵尸
- 32x32
- 主角 8 方向行走
- 敌人 4 方向行走
- 导出 spritesheet

### 产物
- 生成脚本：`/Users/fengnian/my-game/scripts/generate_pixel_assets.py`
- 输出目录：`/Users/fengnian/my-game/assets/generated/pixel_pack_v1/`
  - `frames/`：逐帧 PNG
  - `sheets/`：spritesheet + JSON
  - `preview_4x/`：4x 预览图

### 规格
- 主角：8向 * 4帧 = 32 帧
- 每种僵尸：4向 * 4帧 = 16 帧
- 3种僵尸总计：48 帧
- 主包：80 帧（主角32 + 僵尸48）

### 输出文件（关键）
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/hero_8dir_walk_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/hero_8dir_walk_32.json`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/zombie_walker_4dir_walk_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/zombie_runner_4dir_walk_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/zombie_brute_4dir_walk_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/survivor_plus_3zombies_master_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v1/sheets/survivor_plus_3zombies_master_32.json`

### 备注
- 已按像素风约束：固定 32x32、无抗锯齿、透明 PNG。
- 如需风格靠近你上传参考图，可继续做 V2：增强破损细节、加披风/护具层、提高轮廓对比、补攻击与受击动画。

## 2026-02-18 V2素材迭代：破败末日风 + 攻击/受击/死亡

### 目标
- 在 V1 基础上强化“破败末日”细节（污渍、破损、血迹、死亡血泊）
- 补全动画：`walk / attack / hurt / death`

### 生成脚本
- `/Users/fengnian/my-game/scripts/generate_pixel_assets_v2.py`
- 复跑命令：
  - `python3 /Users/fengnian/my-game/scripts/generate_pixel_assets_v2.py`

### V2输出
- 根目录：`/Users/fengnian/my-game/assets/generated/pixel_pack_v2/`
  - `frames/`：逐帧PNG
  - `sheets/`：spritesheet + JSON
  - `preview_4x/`：4x放大预览

### 角色规格
- 主角（8向）
  - walk: 4
  - attack: 4
  - hurt: 2
  - death: 6
  - 合计：`8 * (4+4+2+6) = 128帧`
- 每种僵尸（4向，walker/runner/brute）
  - walk: 4
  - attack: 4
  - hurt: 2
  - death: 5
  - 合计：`4 * (4+4+2+5) = 60帧/种`
- 主包总帧数：`128 + 60*3 = 308`

### 关键文件
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/hero_8dir_full_v2_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/hero_8dir_full_v2_32.json`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/zombie_walker_4dir_full_v2_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/zombie_runner_4dir_full_v2_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/zombie_brute_4dir_full_v2_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/survivor_plus_3zombies_master_v2_32.png`
- `/Users/fengnian/my-game/assets/generated/pixel_pack_v2/sheets/survivor_plus_3zombies_master_v2_32.json`

### 备注
- JSON内已包含动作分组动画键（按 `entity_direction_action` 组织）。
- 预览图可在 `preview_4x/` 快速审风格与动作节奏。

## 2026-02-18 (V2 spritesheet runtime integration)
- Wired V2 spritesheet preload + auto animation registration in `BootScene`:
  - `hero_v2` and `zombie_v2_{walker|runner|brute}` loaded from `/assets/generated/pixel_pack_v2/sheets/`.
  - Auto-registered directional `walk/attack/hurt/death` keys via shared config (`src/data/v2SpriteAnims.ts`).
- Added shared animation config module `src/data/v2SpriteAnims.ts` (keys, paths, frame spans, naming helpers).
- Game runtime hookup:
  - Player now prefers `hero_v2` texture (fallback to old `player`) and plays V2 actions.
  - Enemy spawns prefer V2 textures mapped from legacy types (`zombie->walker`, `runner->runner`, `tank->brute`).
  - Added per-frame directional walk animation updates for player/enemies.
  - Triggered action clips: player attack/hurt/death, enemy attack/hurt/death.
  - Added enemy death guard (`ed.dead`) to prevent repeated kill processing; body disabled before death cleanup.
  - Disabled `flipX` when using directional V2 enemy/player sprites (to avoid direction mismatch).
- Deployment path fix:
  - Copied V2 assets into `public/assets/generated/pixel_pack_v2/sheets` so Netlify/dist serves `/assets/generated/...` paths.
- Verification:
  - `npm run build` passed.
  - Confirmed built output contains `dist/assets/generated/pixel_pack_v2/sheets/*`.

## 2026-02-18（美术重构第二批：基地/地图/NPC/伙伴/UI统一）

### 本轮目标
- 不再只做局部修补，补齐“基地设计、房屋设计、NPC设计、伙伴设计、地图设计、UI设计”的整体感。

### 已完成（资产层）
- 文件：`src/scenes/BootScene.ts`
- 新增地表/地物贴图：
  - `deco_boulder`、`deco_pine`、`deco_billboard`、`deco_river_pier`、`deco_cave_stalagmite`
- 新增基地与房屋贴图：
  - `base_hq_hall`、`base_residence_block`、`base_workshop_block`、`base_clinic_block`
  - `house_tower_ruin`、`house_block_ruin`、`shop_kiosk_ruin`
  - `forest_cabin`、`cave_watch_post`

### 已完成（场景接线）
- 文件：`src/scenes/GameScene.ts`
- 地图分区重构（白天探索层）：
  - 河流区新增码头/河边小屋/石块，水域视觉更明确；
  - 森林区加入松树变体、林间小屋、广告牌遗迹；
  - 城区改为多种房屋废墟混排（高层/街区/店铺）；
  - 山洞区加入前哨站与石笋群，探险区辨识度更高。
- 探索点图标更换为场景对应贴图（不再都是同类点位图标），并补了大图标缩放规则。
- 基地场景重构：
  - 指挥厅（HQ）+ 生活区 + 制造区 + 医疗区分区落地；
  - 基地外围住区与塔楼废墟重新编排；
  - 分区标签与主招牌字号/可读性同步提升。
- 伙伴/NPC视觉：
  - 驻守伙伴增加职业色环（坦/狙/医），标签显示更明确；
  - 幸存者呼救文本与基地角色标签统一改为高清中文字体。
- 文本体系统一：
  - GameScene 中旧 `Courier New` 文本替换为统一中文 UI 字体栈。

### 已完成（UI面板统一）
- 文件：
  - `src/scenes/UIScene.ts`
  - `src/scenes/MenuScene.ts`
  - `src/ui/ExchangePanel.ts`
  - `src/ui/GlassesShopPanel.ts`
  - `src/ui/LeisurePanel.ts`
  - `src/ui/LevelUpPanel.ts`
  - `src/ui/CollectionPanel.ts`
  - `src/ui/StoryOverlay.ts`
- 统一字体栈：全部切换为 `PingFang/微软雅黑/Noto Sans SC` 系列，移除关键模块中的 `Courier New`。
- 关键弹窗加入移动端字号放大策略（`fs()`）并提高小屏最小字号下限。
- 菜单角色阵列加入更多伙伴变体（坦/狙/医）以体现阵容差异。
- UIScene 的提示文案（装备提示/任务完成/底部操作说明）改为同一字体体系并放大。

### 验证
- `npm run build` 通过（TypeScript + Vite）。
- Playwright 目测回归：
  - 本地 `http://127.0.0.1:4173` 可正常渲染；
  - 新基地分区、地图新地物与探索点标签可见；
  - console `error` 为 0。

### 下一步建议
- 第三批可继续做“基地内装+功能房间可进入层”（宿舍/医务/工坊各自内部小场景）。
- 地图可再加“道路断桥、地下通道入口、城市街区分块命名”提升探索叙事。

## 2026-02-18（美术重构第三批：基地建筑扩容 + 地图地标 + 建造UI改版）

### 本轮目标
- 继续补足“基地/房屋/NPC/伙伴/地图/UI”缺口，做可见的整体提升，不是仅调字号。

### 已完成（素材层扩展）
- 文件：`src/scenes/BootScene.ts`
- 新增地图地标贴图：
  - `deco_wreck_car`、`deco_barricade`、`deco_radio_tower`
  - `deco_bridge_broken`、`deco_river_boat`
  - `deco_forest_shrine`、`deco_cave_gate`
- 新增基地建筑贴图：
  - `base_command_center`、`base_market_arcade`
  - `base_training_yard`、`base_drone_hangar`
- 新增房屋废墟贴图：
  - `house_duplex_ruin`、`house_factory_ruin`、`house_clinic_ruin`
- 新增NPC与伙伴变体贴图：
  - NPC：`npc_guard`、`npc_doctor`、`npc_engineer`、`npc_scout`
  - 伙伴：`companion_engineer`、`companion_raider`、`companion_support`

### 已完成（场景接线）
- 文件：`src/scenes/GameScene.ts`
- `createExplorationWorld()` 新地标落地：
  - 河流区新增断桥、河船、路障；
  - 森林区新增祭坛与通信塔；
  - 城区新增多类废墟楼体（双拼/厂房/诊所）+ 报废车辆与路障散布；
  - 山洞区新增洞门与中继塔，强化“探险入口”识别。
- 白天点位扩容：
  - 新增 `river_fishing_2`（旧桥渔点）
  - 新增 `city_scavenge_3`（坍塌诊所）
  - 新增 `cave_explore_2`（深层裂隙）
- 基地 `createVillageScenery()` 扩容：
  - 加入指挥区/后勤区面片与分区标识；
  - 接入新增基地建筑（指挥中心、市场长廊、训练区、无人机库）；
  - 两侧外缘增加更多废墟房屋层次；
  - 追加基地杂物（路障/报废车）与环境细节；
  - 增加环境NPC（侦察员、维修师、医务官、巡逻兵）和驻守伙伴展示位。
- 伙伴视觉差异增强：
  - `getCompanionRoleTexture(role, seed)` 改为按角色+ID稳定选取变体贴图；
  - 基地驻守和幸存者池都可出现新增伙伴外观。

### 已完成（UI设计）
- 文件：`src/ui/BuildPanel.ts`
- 建造面板改版：
  - 头部视觉层次重做（标题带、说明带、分区带）；
  - 分类TAB改为等宽芯片按钮（选中高亮边框+分类色）；
  - 建筑卡片改为网格布局（多列多行），不再一行平铺；
  - 卡片增加类别色条、图标框、耗材行、状态行（已选中/点击建造/资源不足）；
  - 低端口径保留指针热区逻辑，兼容原点击行为。

### 验证
- `npm run build` 通过。
- Playwright 运行检查：
  - 菜单和游戏场景均可进入；
  - 新基地建筑、NPC点位、地图地标均可见；
  - 控制台 `error` 为 0。

## 2026-02-18（基地清爽化修正）

### 用户反馈
- “基地一片混乱，贴图一片混乱”。

### 修正动作
- 文件：`src/scenes/GameScene.ts`
- `createVillageScenery()` 做减法重排：
  - 删除基地内部大部分冗余贴图堆叠（多余废墟/路障/报废车/环境NPC）；
  - 保留核心骨架：商店主体 + 左生活区 + 右制造区 + 下医疗区 + 上指挥区；
  - 调整区块遮罩与分区标签位置，降低视觉噪声。
- 新增探索点降噪逻辑：
  - `refreshExplorationMarkerVisibility()`：
    - 玩家在基地区域时，远处探索点标记自动隐藏；
    - 仅在靠近时显示，避免标记压住基地主视图。
  - 已接入 `update()` 循环。

### 验证
- `npm run build` 通过。
- Playwright 实机截图确认基地主画面已明显简化，UI可读性提升。
- 控制台 `error` 为 0。

## 2026-02-18（基地/地图/UI 第四轮重构：去混乱与空间逻辑重排）

### 用户反馈
- “基地也要重新设计”
- “地图背景不自然，贴图没有逻辑”
- “整体UI需要统一”

### 本轮改动
- 文件：`src/scenes/BootScene.ts`
  - `generateTerrainTextures()` 重排地形底图：
    - 河流主干与分支整体左移，避免穿过基地核心视野。
    - 城区/荒野/森林/洞穴分布重新平衡，减少硬切割感。
    - 路网左侧支路重排，使“基地中轴 + 外围区块”关系更清晰。

- 文件：`src/scenes/GameScene.ts`
  - `createExplorationWorld()` 重写布局逻辑：
    - 河流改为“多椭圆水体拼接”，去掉大矩形水块边界。
    - 城区贴图重排到左上，收窄边界，避免压入基地中心。
    - 森林/洞穴保持远端分区，并统一阴影+色调规则。
    - 白天探索点位坐标重排（河流/城区）以匹配新地形。
  - `isInsideRiver()`、`getWorldZoneAt()` 同步新地形范围。
  - `refreshExplorationMarkerVisibility()` 在基地内进一步收紧显示半径，减少标记噪声。
  - `createVillageScenery()` 二次重构：
    - 基地改为“中轴大厅 + 左右功能区 + 下部后勤”结构。
    - 减少大面积遮罩块，改为轻量分区引导线。
    - 调整任务官/NPC/设施点位，减少标签互相遮挡。
    - 去除易被HUD遮挡的“指挥区”顶部标签。

- 文件：`src/scenes/UIScene.ts`
  - HUD统一风格与可读性：
    - 顶栏加高与分隔线增强。
    - 左侧资源区、右侧状态区、底部控制说明统一配色与层次。
    - 资源格与右状态行字号放大。
  - 小地图重绘：
    - 从硬矩形分区改为椭圆分区+道路+河流组合，更贴合新地图逻辑。

### 验证
- `npm run build` 通过（多次回归）。
- Playwright截图目测：
  - 基地中心区明显更干净，外部探索区与基地区分更清楚。
  - 地图分区视觉逻辑更连贯，不再是“硬块贴图叠加”观感。
- Playwright console `error`：0。

### 下一步建议
- 用真正的地面 tile 套件替换当前程序化地块（砖地/泥地/草地/沥青）可再提升一档。
- 基地内可加入“可进入子房间”切场景，进一步增强基地设计完成度。

## 2026-02-18（风格定向：生活营地风，降低硬核感）

### 用户方向
- “生活营地风（有生活感、没那么硬核）”

### 本轮改动
- 文件：`src/scenes/BootScene.ts`
  - `generateVillageTextures()` 调整基础地表色系：
    - `village_ground` 从冷蓝网格改为偏泥土/苔藓的生活化底色。
    - `village_path` 改为更暖的木土路径纹理。
  - 新增生活营地贴图：
    - `camp_tent`（帐篷）
    - `camp_garden_box`（菜箱）
    - `camp_clothesline`（晾衣绳）
    - `camp_table`（营地餐桌）
    - `camp_string_lights`（串灯）

- 文件：`src/scenes/GameScene.ts`
  - `createBackground()` 基地环形背景由冷蓝改为暖色土黄系。
  - `createVillageScenery()` 营地风落地：
    - 基地中心区加入帐篷/菜箱/餐桌/晾衣等生活化陈设。
    - 主建筑前增加串灯与暖色光晕，营造“居住中的营地”氛围。
    - 区块线条和建筑 tint 由冷蓝改为更柔和暖色。
    - 基地主牌改为 “生活营地 · 安全区”。

- 文件：`src/scenes/UIScene.ts`
  - HUD 色调软化：
    - 顶栏分隔线、最小地图边框、控制提示文字改为暖色强调。
    - 左右信息板背景改为更柔和的深灰棕系，降低“军工蓝”硬感。
    - 保留原信息结构，避免交互习惯被破坏。

### 验证
- `npm run build` 通过。
- Playwright 实机截图确认：基地出现明显生活设施（串灯、菜箱、帐篷等），视觉更接近生活营地。
- console `error` 为 0。

### 后续可继续
- 增加“白天营地活动动画”（晾衣摆动、炉火炊烟、伙伴围桌）可进一步强化生活感。
- 将任务/基地/仓库面板也换成同一营地UI皮肤（木框+暖灯）可做到风格闭环。

## 最新进展（2026-02-18）
- [x] 人物可视尺寸重做：玩家、出战伙伴、基地驻守伙伴、NPC、敌人/Boss 统一改为像素友好的整数缩放（2x/3x），并将主相机缩放固定为整数 `1`，减少像素拉伸模糊。
- [x] 子弹弹幕重构：主武器/VS/炮塔/驻守伙伴子弹补充统一的 `bulletTextureKey + sway` 轨迹数据，新增蛇形/脉冲/链式等弹道摆动，增强弹幕辨识度。
- [x] 轨迹特效重做：`updateBulletTrails` 从圆点改为像素矩形尾迹（按 bullet archetype 区分），火焰/连锁/冰冻增加附加粒子。
- [x] 命中特效重做：`createBulletImpactVfx` 改为按弹种分型（炮击/链电/冰冻/贯穿等）并增加命中碎片与扩散层。
- [x] 投射物贴图重画：`BootScene.generateProjectileSprites()` 改为硬边像素形体（避免软圆糊边），强化每种子弹视觉差异。
- [x] 编译验证：`npm run build` 通过。
- [x] 自动化实机验证：`npm run test:game` 与多轮 Playwright 回放通过，`errors-0.json` 无报错；夜战场景状态捕获到 `bullets: 25`，说明弹幕逻辑与特效链路已实跑。

### 待继续
- [ ] 继续做“生活营地风”地图美术重构：基地建筑布局、街区/河岸/森林叙事层次统一。
- [ ] 补一轮移动端真机触控回归（按钮布局 + 竖屏密度 + 文本可读性）。
- [x] 左上资源 HUD 紧凑化：面板宽高收敛、资源格缩小，减少遮挡地图与视野。
- [x] 左上 HUD 增加一键折叠：新增“收起/展开”按钮，折叠后隐藏资源格/波次/任务，仅保留血量与击杀。
- [x] 已验证：`npm run build` 通过；Playwright 点击验证折叠交互可用，控制台无错误。
- [x] 左上HUD折叠修正：折叠态面板改为窄条宽度，按钮随状态重定位，不再保留整块灰色底框。
- [x] 左上HUD可读性：折叠时隐藏血条图形与次级信息，保留核心数字；展开态继续显示完整资源/波次/任务。
- [x] 建筑贴图美化二轮：`wall/turret/barricade/kitchen/workbench/guard_post` 增加旧化细节、灯条反光、阴影层和警示色。
- [x] 子弹表现增强二轮：新增发射口 `muzzle flash`（玩家/炮塔/驻守伙伴）并按弹种分型。
- [x] 验证：`npm run build` 通过；Playwright 折叠点击与渲染正常，`errors-0.json` 为空。

- 2026-02-19 mobile perf pass: added adaptive low/ultra mobile performance tiers (fps, arcade fps, bullet VFX throttling, weather particle throttling, damage text limits, lighting/update throttles).
- 2026-02-19 deploy note: documented CN-friendly deployment alternatives to Netlify in README (Cloudflare Pages / COS+CDN / OSS+CDN / OBS+CDN).
- 2026-02-19 verification: npm run build passed; Playwright client smoke ran with no new console/page errors but remained in menu state (state json scene=menu), needs dedicated menu-start automation selector later.

- 2026-02-19 redesign pass: daytime map spots now support active manual exploration chain (risk/reward, cooldown, day buffs, threat spawns, XP + resource payouts) instead of passive-only hints.
- 2026-02-19 progression pass: added dynamic level upgrade bonuses + level surge state for stronger visible power spikes; wired level-up choice to trigger surge feedback.
- 2026-02-19 XP reliability: GameScene now routes XP through grantExperience() to emit EXP/LEVEL events consistently; GameState.addExperience now handles multi-level gains in one grant.
- 2026-02-19 validation: npm run build passed. Playwright smoke executed with no console/page errors but headless capture still stuck on black/menu frame in this environment.

## 2026-02-23（白天玩法重构：小游戏 + 民生热点脉冲）

### 用户反馈
- 白天没有真正小游戏，过程无聊。
- 伙伴生活感不够，缺少“民生气息”。

### 本轮实现
- 文件：`src/scenes/GameScene.ts`
  - 修复编译阻断：补齐缺失的 `maybeEmitDayLifeAtmosphere()`。
  - 新增白天“生活热点”系统：
    - 河流/森林/城区/山洞探索点会周期性触发短时热点（高收益/高风险词缀）。
    - 热点写入 `daySpotBonuses`，带 `rewardMul/dangerMul/bonusXp/expiresAt`。
    - 热点会同步到探索点状态与交互提示（`updateExplorationSpotStatus/getExplorationHintText`）。
  - 热点接入探索结算：
    - `executeActiveExploration()` 会消耗热点并叠加收益、风险和额外经验，形成明显“白天冲点”动机。
  - 白天小游戏面板增强：
    - 若当前点位存在热点，会在小游戏面板中直接展示热点信息。
  - 伙伴生活氛围增强：
    - `maybeEmitDayLifeAtmosphere()` 在无热点可刷时触发居民日常生活文本/小额补给/偶发协助任务，提升白天“有人在生活”的反馈密度。
  - 生命周期清理补全：
    - 新增 `daySpotBonuses`、`dayLifePulseTimer` 在 `onDayStart/onNightStart/shutdown` 的重置与清理，防止状态残留。

### 兼容性修正
- 移除 `handleExplorationSpotInteraction()` 中未使用局部变量，消除 TS noUnusedLocals 报错。

### 验证
- `npm run build` 通过。
- `npm run test:game` 通过（本地起服后）：
  - `output/web-game/errors-0.json` 为空。
  - `output/web-game/state-0.json` 显示已进入 `scene=game`，白天场景正常运行。
- 2026-02-23 daytime mini-game V2: exploration mini-game split by action type (fish/swim/hunt/scavenge/cave) with distinct timing profiles, moving target windows, and trap zones (for scavenge/cave).
- 2026-02-23 mini-game UX: panel now shows mode title + rule text; risk mode dynamically shrinks target width / speeds target movement.
- 2026-02-23 reward coupling: mini-game quality now computed against dynamic target center/width (not fixed 0.5), trap-hit forces poor result and can trigger backlash damage.
- 2026-02-23 validation: npm run build passed; npm run test:game passed; output/web-game/errors-0.json is empty.
- 2026-02-23 daytime mini-game V3 visual pass: per-zone panel theming (river/forest/city/cave accent color + icon + title band), no longer shared visual skin.
- 2026-02-23 daytime mini-game result FX: added lock-result banner + world spark burst + quality-linked camera response (perfect flash / fail shake), including trap-trigger feedback.
- 2026-02-23 performance-safe FX: result particles scale down under low/ultra mobile performance tiers.
- 2026-02-23 validation: npm run build passed; npm run test:game passed; output/web-game/errors-0.json is empty.
- 2026-02-23 daytime risk differentiation V4: area-specific failure penalties implemented.
- River (fish/swim) failure now yields low reward only (reduced multipliers, no forced damage), preserving low-risk identity.
- Forest (hunt) failure now applies direct player injury (damage event) as main penalty.
- City (scavenge) failure now applies durability-wear debuff stacks (temporary player damage reduction), with trap-hit causing heavier wear.
- Cave (cave_explore) failure now guarantees enemy aggro spawn, making failure cost map pressure instead of pure HP loss.
- Added durability wear lifecycle: stack/expire handlers and live damage multiplier integration in player damage pipeline.
- Validation: npm run build passed; npm run test:game passed; output/web-game/errors-0.json is empty.
- 2026-02-23 HUD debuff pass: added top-left durability-wear indicator (icon + stack-based damage reduction text + remaining-time bar), supports expanded/collapsed HUD layout.
- 2026-02-23 penalty feedback pass: added zone-specific failure VFX+SFX for river/forest/city/cave penalties.
- River fail: ripple FX + soft low-risk tone; Forest fail: slash FX + hit shake + harsh tone; City fail: spark/flash + wear-warning tone; Cave fail: purple shockwave + alert tone.
- 2026-02-23 durability-state bridge: exposed runtime duration metadata from GameScene for UIScene countdown bar synchronization.
- 2026-02-23 validation: npm run build passed; npm run test:game passed; output/web-game/errors-0.json is empty.
- 2026-02-23 daytime loop expansion V5: added daily exploration challenge system (action-type specific objective with quality threshold + progress + completion rewards).
- 2026-02-23 challenge UX: exploration spot hints/status now show challenge progress for matching zones; day-start summary now includes today's challenge objective.
- 2026-02-23 counterplay update: workbench interaction now repairs durability-wear debuff stacks (with remaining penalty feedback), creating a clear recovery loop after city failure.
- 2026-02-23 validation: npm run build passed; npm run test:game passed; output/web-game/errors-0.json is empty.

## 最新进展（2026-02-23 每日分支层）
- [x] 日挑战重构为“3选1分支”：白天开局弹出 `稳妥 / 冒险 / 极限` 选择面板，不再是单一随机挑战。
- [x] 分支接入永久成长：`GameState.meta` 新增 `dayChallengeMastery`（持久化、旧存档兼容、跨轮次保留），完成挑战可提升对应分支精通。
- [x] 分支精通收益接入实战：
  - `稳妥`：日间风险缓解与稳态收益提升
  - `冒险`：日间收益与比特币奖励提升
  - `极限`：常驻伤害/经验增益更高
- [x] 白天探索小游戏升级为“多回合”判定：
  - 河流/游泳：2回合
  - 森林/城区：3回合
  - 山洞：4回合
  - 每回合记分，最终按总分与陷阱命中计算 `poor/good/perfect`，避免单次判定千篇一律。
- [x] `render_game_to_text` 输出扩展：加入 `dayChallengeSelectionOpen / dayChallenge / dayChallengeChoices / dayChallengeBranchSelected` 便于自动化验证。
- [x] 构建验证：`npm run build` 通过。
- [x] 自动化验证：`npm run test:game` 通过，`output/web-game/errors-0.json` 为空；并额外验证了“分支选择前后”状态与截图。

### 后续建议
- [ ] 把“探险”扩展为真正独立玩法模板（例如：洞穴横版战斗小关 + 森林追踪战 + 城区潜入搜刮 + 河流节奏类），复用现有分支奖励池。
- [ ] 为四类点位补专属音效包与回合结算 VFX，让回合差异体感更明显。
- [ ] 给每日分支面板加移动端快捷按钮（1/2/3）与倒计时自动选择，防止新手停留过久。

## 最新进展（2026-02-23 洞穴短横版战斗关 V1）
- [x] 山洞玩法从“单次判定条”切换为独立短横版战斗实例（进入后锁定为洞穴战斗面板）。
- [x] 洞穴战新增三阶段流程：
  - 阶段1：清杂兵（稳妥4 / 冒险6）
  - 阶段2：陷阱房生存（稳妥11s / 冒险9s）
  - 阶段3：小Boss房（含杂兵压力）
- [x] 洞穴战新增平台层与跳跃手感：
  - 角色可用 `W/↑` 跳跃
  - 战斗区加入上下平台，避免纯平面站桩
  - 移动端摇杆上推可触发跳跃
- [x] 洞穴敌人AI分型：
  - `runner`（贴身压迫）
  - `leaper`（跳扑）
  - `spitter`（远程吐射，平台位）
  - `boss`（弹幕/陷阱技能循环，半血强化）
- [x] 洞穴陷阱扩展：
  - 地雷爆震（地面范围）
  - 落石砸击（纵向掉落）
- [x] 调试链路增强：
  - `__debug_open_cave_raid` 可在“每日挑战弹窗”存在时自动兜底选择分支后继续开洞穴，避免测试被阻塞。
  - `render_game_to_text` 的 `dayMiniGame` 增加 `caveStage/caveStageProgress/caveStageObjective/caveTrapHits`。
- [x] 稳定性修复：
  - 修复洞穴阶段切换时 `caveRaidEnemies` 变更导致的 `undefined.sprite` 崩溃（循环中增加空值保护）。
- [x] 验证结果：
  - `npm run build` 通过。
  - `npm run test:game` 通过，`output/web-game/errors-0.json` 为空。
  - Playwright实测：可稳定打开洞穴战，平台/跳跃/三阶段状态字段可读取，无新的控制台报错。

## 最新进展（2026-02-23 森林追踪狩猎战 V1）
- [x] 森林点位改为独立“潜行 + 爆发”玩法，不再复用通用单条判定：
  - 潜行阶段：左右位移追踪猎迹，避开猎物视野锥；`[E]` 屏息可压低警觉。
  - 爆发阶段：移动窗口射击条，按 `E/Space` 在绿色窗口开火结算当回合得分。
- [x] 冒险/稳妥风险预设接入森林玩法：
  - 冒险：潜行时限更短、爆发窗口更窄、目标移动更快，但走高收益倍率。
  - 稳妥：窗口更宽、时限更宽松，容错更高。
- [x] 多回合结算接入：按总分 + 暴露/失误计算 `poor/good/perfect`，并回传到探索奖励链。
- [x] 手感强化：
  - 新增潜行阶段“屏息冷却”实时提示；
  - 新增“被发现”专属反馈（红色脉冲 + 震屏 + 浮字）；
  - 新增爆发命中专属 VFX（完美/良好/失手差异化闪爆）。
- [x] 调试链路：新增 `window.__debug_open_forest_hunt()` 直接开森林玩法，便于快速验收。
- [x] 验证结果：
  - `npm run build` 通过。
  - `npm run test:game` 通过，`output/web-game/errors-0.json` 为空。
  - Playwright 实测可进入森林玩法，`render_game_to_text` 显示 `dayMiniGame.mode = hunt` 且阶段状态正常切换。

## 最新进展（2026-02-23 城区限时搜刮战 V1）
- [x] 城区点位切换为独立玩法“限时搜刮战（路线+负重）”，不再使用通用判定条。
- [x] 新增路线分支：
  - `背街小巷`：低风险、基础收益
  - `废墟商街`：均衡风险/收益
  - `高架屋顶`：高风险、高回报
- [x] 新增负重机制：
  - 搜刮战利品会增加 `kg` 负重与分值；
  - 负重越高，移动越慢；超重会显著拖慢并提高警报压力。
- [x] 新增限时+巡逻警报：
  - 倒计时结束会强制失手撤离；
  - 巡逻警报命中会累计失败惩罚并掉失部分负重/分值。
- [x] 新增撤离结算：
  - 必须回到左侧撤离区执行撤离动作结算；
  - 结算按“分值/目标 + 警报/超重惩罚”评定 `poor/good/perfect`，并接入原探索奖励链。
- [x] 输入与调试链路补全：
  - 键盘/移动端交互都可触发搜刮与撤离；
  - 新增 `window.__debug_open_city_scavenge()` 快速打开城区玩法；
  - `render_game_to_text` 新增城区状态字段（路线、负重、分值、警报、计时、是否撤离）。
- [x] 验证结果：
  - `npm run build` 通过；
  - `npm run test:game` 通过，`output/web-game/errors-0.json` 为空；
  - Playwright 定向检查可进入城区玩法并触发结算，控制台无 error。

## 最新进展（2026-02-23 角色美术 + 弹幕系统 + 升级系统重构）
- [x] 伙伴外观修复：获救后不再统一回退到巫师斗篷贴图。
  - `CompanionSystem` 改为按职业/转职阶段自动分配贴图（`companion_tank/sniper/medic/support/raider/engineer`），并在升级/转职时自动刷新外观。
  - 伙伴配置与存档数据新增 `textureKey`，保证出战/驻守切换后外观一致。
- [x] 伙伴弹幕增强：不同职业有明显弹道差异。
  - 坦克：爆炸型多弹片 + 高等级爆发齐射。
  - 狙击：高速度穿透束 + 低扩散精确压制。
  - 医疗：追踪/连锁脉冲弹 + 高等级辅助爆发。
- [x] 玩家弹幕系统升级：`WeaponSystem` 新增更丰富签名弹幕形态。
  - 新增弧形/环形签名弹发射逻辑，支持轨迹摆动参数（幅度/频率/相位）。
  - 根据武器类型触发差异化签名弹（手枪、霰弹、步枪、喷火、激光、火箭各自不同）。
  - VS武器补充“额外环形爆发弹”逻辑，提升高等级割草体感。
- [x] 升级系统全面强化：新增“战斗协议（run内叠层）”。
  - `LevelUpPanel` 新增 `战斗协议` 卡牌类型，支持等级显示（`Lv.x -> Lv.y / max`）。
  - `EvolutionSystem` 新增协议分支：
    - 弹幕矩阵、相位穿矛、过载链路、回声反应堆、猎手本能、伙伴协同。
  - 协议升级会直接影响战斗计算（伤害/射速/弹速/投射物/穿透/签名触发率/轨迹复杂度/伙伴同步增益）。
  - 协议选择加入强度预览文案，关卡内升级反馈更明显。
- [x] 验证结果：
  - `npm run build` 通过；
  - `npm run test:game` 通过；
  - `output/web-game/errors-0.json` 为空。

## 最新进展（2026-02-23 夜间 UI 贴图化）
- [x] 白天四类小游戏 UI 从程序化几何层升级到贴图化皮肤包接入：
  - `GameScene.addMiniGameRectSkin` 扩展支持 `tile` 皮肤层。
  - 河流/森林/城区/洞穴四套小游戏入口统一接入 `mg_*` 贴图（风险卡、按钮、条形区、场地底纹）。
  - 城区/洞穴补齐主题图标入口（`addMiniGameThemeIcon`），森林/河流保持统一样式。
- [x] 清理重复贴图调用：河流小游戏风险卡皮肤重复叠加已移除。
- [x] 编译验证：`npm run build` 通过。
- [~] 自动化截图验证：`develop-web-game` 客户端仍出现黑屏截图（已知 headless/WebGL 捕获问题）；改用 Playwright MCP 页面截图确认菜单渲染正常，后续需要补“进入游戏后 + 打开四类小游戏窗口”的实机截图回归。

### TODO（下一步）
- [ ] 给四套皮肤补独立按钮状态贴图（normal/hover/pressed）并接输入反馈。
- [ ] 四类小游戏内的道具/陷阱对象替换为专属 icon atlas（不再用纯色矩形）。
- [ ] 补跑可见截图回归：进入游戏后分别打开河流/森林/城区/洞穴面板并留档。

## 最新进展（2026-02-23 主玩法扩展）
- [x] 白天主线新增「日内委托系统」：每天自动生成2条委托（河流/森林/城区/洞穴），按质量与风险条件推进，完成后即时结算资源+经验+比特币。
- [x] 新增「夜战筹备层数」：白天完成委托可累积筹备层，夜晚转化为战术指令增益，形成“白天经营 -> 夜晚战斗”闭环。
- [x] 夜晚主线新增「战术指令选择」：夜晚开始会进入3选1（坚守防线/猎杀出击/夜行回收），分别改变夜间伤害、掉落、经验与敌压强度；支持自动兜底选择。
- [x] 新增「夜间压力波」：不同夜战指令会周期触发不同强度的压力敌潮；夜行回收路线会额外触发夜间回收收益。
- [x] 战斗线新增「战意爆发」：击杀会累计战意值，满值触发短时爆发窗口（伤害/射速/弹道增强），并接入视觉反馈脉冲。
- [x] 装备收集线新增「图鉴解锁奖励」：首次获得某稀有度装备时，触发图鉴解锁并奖励经验与比特币。
- [x] 装备线新增「共鸣套装」：根据已装备武器位的稀有度组合动态计算共鸣层级（伤害/射速/移速/额外投射物/掉落），并周期刷新。
- [x] 探索交互可见性增强：地图点位状态与 `[E]` 提示文本已接入“委托进度 + 夜间指令”信息，白天目标和夜晚策略更可感知。
- [x] 调试信息扩展：`render_game_to_text` 状态中新增 dayOps/nightDirective/battleMomentum 字段，便于回归验证。
- [x] 回归结果：`npm run build` 通过；运行态手工联调验证白天委托推进、夜间指令生效、战意爆发触发、装备共鸣计算与图鉴奖励逻辑均可执行；控制台 error 为 0。

## 最新进展（2026-02-24 手机夜战指令 + 委托任务链 + 节奏平衡）
- [x] 夜间战术指令手机端可点击闭环完成（不依赖键盘）：
  - 夜间选择面板改为移动端友好布局（竖屏卡片纵向排布 + 大点击区按钮 `触控执行指令`）。
  - 每个指令加入专属图标（坚守盾徽/出击双刃/回收补给箱）及持续脉冲动画。
  - 回归验证：竖屏下触发 `pointerdown` 可直接执行指令，面板关闭并写入夜战增益。
- [x] 日内委托升级为“前置 -> 执行 -> 交付”多阶段任务链：
  - 新增前置物资消耗与任务官下发逻辑（`prep` 阶段）。
  - 白天点位完成条件后进入 `handoff`，需要到任务官交付后才发奖励（资源/经验/比特币/夜战筹备）。
  - 接入永久成长：新增 `dayOpsRenown` 声望值，交付后永久累积并影响后续局内收益、经验、夜战指令伤害与筹备上限。
- [x] 前3天爽感提升，中后期成长拉长：
  - `GameScene.getRunPacingProfile`：前3天提高 XP/奖励并降低目标与危险，中后期反向提高目标/压力并轻微压低收益。
  - `WaveSystem.getDayBalanceProfile`：前3天减少敌数与刷怪强度，中后期提高敌潮密度与生存能力。
  - `GameState.addExperience`：经验需求曲线分段，前期升级更快、后期抬升更明显。
- [x] 验证结果：
  - `npm run build` 通过。
  - Playwright + `render_game_to_text` 运行态检查通过：
    - 夜间面板出现“手机端：直接点击下方大按钮执行指令”与3个“触控执行指令”按钮；
    - 指令按钮点击后 `nightDirective.open: true -> false`，并写入 `nightDirective.id/effects`；
    - 委托链可从 `execute -> handoff -> done`，交付后 `renown` 与 `prepStacks` 增长。
