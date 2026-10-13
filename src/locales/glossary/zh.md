# Chinese (Simplified) glossary

Terms every `zh.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Buttons and menu items are short verbs: “添加城镇”, “删除全部”, “保存”.
- Tooltips and hints start with a verb of action: “点击以更改标记”, “拖动以移动”.
- Confirmations are questions with 吗？: “确定要删除这个城镇吗？”. Ending with “此操作无法撤销” is fine.
- Dialog titles and editors name the thing: “城镇编辑器”, “概览”. Inline actions use “编辑”, “更改”.
- Use full-width punctuation (，。？！：；) and curly quotes “ ” for quoted names. Never straight `"`.
- Put a space between Chinese and a Latin word or number: “API 密钥”, “3 个城镇”.
- Keep key names as they are: Ctrl, Shift, Alt, Enter, Esc, Space. Join them with “ + ”.
- Brand and product names stay Latin: Armoria, FMG, Dropbox, Discord, Google, Azgaar.
  The product is “Azgaar 的奇幻地图生成器”. Azgaar is not translated.
- Keep labels short; the tab menus are narrow.

## Map

| English                       | Chinese                 | Note                                              |
| ----------------------------- | ----------------------- | ------------------------------------------------- |
| map                           | 地图                    |                                                   |
| burg                          | 城镇                    | any settlement                                    |
| capital                       | 首都                    | state capital; a province's is 省会               |
| port                          | 港口                    |                                                   |
| state                         | 国家                    | never 州                                          |
| province                      | 省份                    |                                                   |
| culture                       | 文化                    |                                                   |
| religion                      | 宗教                    |                                                   |
| namesbase                     | 命名库                  | the tab and the culture field are “名称”          |
| heightmap                     | 高程图                  | the layer is “高程”                               |
| template (heightmap)          | 模板                    |                                                   |
| cell                          | 单元格                  |                                                   |
| grid                          | 网格                    |                                                   |
| seed                          | 种子                    |                                                   |
| biome                         | 生物群系                |                                                   |
| feature (island, lake…)       | 地物                    |                                                   |
| continent / island / isle     | 大陆 / 岛 / 小岛        |                                                   |
| lake / sea / ocean / gulf     | 湖 / 海 / 洋 / 海湾     |                                                   |
| freshwater / salt lake        | 淡水湖 / 咸水湖         |                                                   |
| coastline / coast, shore      | 海岸线 / 海岸           |                                                   |
| coastal                       | 沿海的                  |                                                   |
| river / source / mouth        | 河流 / 源头 / 河口      |                                                   |
| route / road / off-road       | 路线 / 道路 / 越野      |                                                   |
| elevation, height / depth     | 海拔、高度 / 深度       |                                                   |
| sea level                     | 海平面                  |                                                   |
| depression / range (template) | 洼地 / 山脉             |                                                   |
| precipitation                 | 降水                    |                                                   |
| temperature                   | 温度                    |                                                   |
| population / rural / urban    | 人口 / 乡村 / 城市      |                                                   |
| area                          | 面积                    |                                                   |
| relief                        | 地形                    | the relief icons are 地形图标                     |
| relief pool / relief set      | 地形池 / 地形集         |                                                   |
| contours / hachures           | 等高线 / 晕线           |                                                   |
| marker / marker type          | 标记 / 标记类型         |                                                   |
| pin (marker shape)            | 图钉                    |                                                   |
| label                         | 标签                    |                                                   |
| label group                   | 标签组                  |                                                   |
| zone                          | 区域                    |                                                   |
| emblem, COA                   | 纹章                    |                                                   |
| charge / tincture / field     | 纹饰 / 色纹 / 盾面      | heraldic terms                                    |
| shield                        | 盾牌                    |                                                   |
| note / legend                 | 注释 / 图例             |                                                   |
| submap                        | 子地图                  |                                                   |
| neutral lands                 | 中立地带                |                                                   |
| expansionism                  | 扩张                    |                                                   |
| full name / short name        | 全名 / 简称             |                                                   |
| state form / province form    | 政体 / 省份形式         |                                                   |
| origin (culture, religion)    | 来源                    |                                                   |
| deity / believers             | 神明 / 信徒             |                                                   |
| folk / organized religion     | 民间信仰 / 有组织宗教   |                                                   |
| cult / heresy                 | 教派 / 异端             |                                                   |

## Politics, military, economy

| English                      | Chinese                       |
| ---------------------------- | ----------------------------- |
| diplomacy / relations        | 外交 / 关系                   |
| ally / friendly / neutral    | 同盟 / 友好 / 中立            |
| suspicion / rival / enemy    | 猜忌 / 对手 / 敌人            |
| vassal / suzerain            | 附庸 / 宗主                   |
| military (forces)            | 军队                          |
| regiment                     | 团                            |
| army / fleet                 | 陆军 / 舰队                   |
| unit (military)              | 兵种                          |
| unit (measure)               | 单位                          |
| crew                         | 船员                          |
| battle / attacker / defender | 战斗 / 进攻方 / 防守方        |
| journey / segment / stay     | 旅程 / 路段 / 停留            |
| transport type / domain      | 运输类型 / 领域               |
| market                       | 市场                          |
| good / goods                 | 商品                          |
| raw / manufactured good      | 原料 / 制成品                 |
| recipe / ingredient          | 配方 / 配料                   |
| production                   | 生产                          |
| stock                        | 库存                          |
| demand / demand coverage     | 需求 / 需求满足率             |
| deal / trade                 | 交易 / 贸易                   |
| price / base price           | 价格 / 基准价格               |
| wealth / gross product       | 财富 / 总产值                 |
| treasury                     | 国库                          |
| sales tax / poll tax         | 销售税 / 人头税               |

## Interface

| English                        | Chinese                          |
| ------------------------------ | -------------------------------- |
| layer                          | 图层                             |
| style / style element          | 样式 / 样式元素                  |
| preset (style) / layers preset | 预设 / 图层预设                  |
| options / settings             | 设置                             |
| tools / editor / overview      | 工具 / 编辑器 / 概览             |
| chart / hierarchy              | 图表 / 层级                      |
| generate                       | 生成（新地图）                   |
| regenerate                     | 重新生成                         |
| lock / unlock                  | 锁定 / 解锁                      |
| locked / unlocked              | 已锁定 / 未锁定                  |
| undo / redo                    | 撤销 / 重做                      |
| toggle                         | 切换                             |
| save / load                    | 保存 / 加载                      |
| download / upload              | 下载 / 上传                      |
| export / import                | 导出 / 导入                      |
| icon / custom icon             | 图标 / 自定义图标                |
| custom (font, name, scheme)    | 自定义                           |
| brush / stroke (brush)         | 笔刷                             |
| opacity / stroke / fill        | 不透明度 / 描边 / 填充           |
| scale bar / compass rose       | 比例尺 / 罗盘玫瑰                |
| measurer, ruler                | 测量工具 / 标尺                  |
| preview                        | 预览                             |
| zoom / pan                     | 缩放 / 平移                      |
| Azgaar Assistant               | Azgaar 助手                      |
| chat / provider / API key      | 聊天 / 服务商 / API 密钥         |
