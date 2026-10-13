# Japanese glossary

Terms every `ja.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Japanese omits the subject: no 「あなた」. Questions and confirmations use the polite form: “削除しますか？”, “本当に削除しますか？”.
- Buttons and menu items are the noun or the verb stem: “保存”, “読み込み”, “すべて削除”.
- Tooltips take the imperative with 「クリック」 or a noun phrase: “クリックしてマーカーを変更”, “クリックで並べ替え”.
- Dialog titles and editor names: “〜の編集”, “〜エディター”; inline actions use “変更”.
- Quotes are 「…」 in place of “ ”. Keep the full-width 、 and 。 in running text.
- Key hints use a plus sign or a dash: “Esc — キャンセル”, “Shift + クリック — 別の国を選択”.
  Keys keep Latin names: Ctrl, Shift, Alt, Enter, Esc, Space.
- Keep labels short for narrow menu tabs; drop a word before dropping a meaning.
- Azgaar is **アズガル** (the product is “アズガルのファンタジーマップジェネレーター”). Brand and product names stay Latin: FMG, Armoria, Dropbox, Discord, Google, Cartography Assets.

## Map

| English                       | Japanese                  | Note                                              |
| ----------------------------- | ------------------------- | ------------------------------------------------- |
| map                           | 地図                      |                                                   |
| burg                          | 集落                      | any settlement; “都市” only in flavour text       |
| capital                       | 首都                      |                                                   |
| port                          | 港                        |                                                   |
| state                         | 国家                      | “国” for short labels                             |
| province                      | 州                        |                                                   |
| culture                       | 文化                      |                                                   |
| religion                      | 宗教                      |                                                   |
| namesbase                     | 命名ベース                | the tab and the culture field are “名前”          |
| heightmap                     | 高度マップ                | the layer is “高度”                               |
| template (heightmap)          | テンプレート              |                                                   |
| cell                          | セル                      |                                                   |
| grid                          | グリッド                  |                                                   |
| seed                          | シード                    |                                                   |
| biome                         | バイオーム                |                                                   |
| feature (island, lake…)       | 地形                      |                                                   |
| continent / island / isle     | 大陸 / 島 / 小島          |                                                   |
| lake / sea / ocean / gulf     | 湖 / 海 / 海洋 / 湾       |                                                   |
| freshwater / salt lake        | 淡水湖 / 塩湖             |                                                   |
| coastline / coast, shore      | 海岸線 / 海岸             |                                                   |
| coastal                       | 沿岸の                    |                                                   |
| river / source / mouth        | 川 / 源流 / 河口          |                                                   |
| route / road / off-road       | 経路 / 道 / 道なし        | “経路” is generic; “ルート” only a pathfinder result |
| elevation, height / depth     | 標高 / 深さ               |                                                   |
| sea level                     | 海面                      |                                                   |
| depression / range (template) | 窪地 / 山脈               |                                                   |
| precipitation                 | 降水量                    |                                                   |
| temperature                   | 気温                      |                                                   |
| population / rural / urban    | 人口 / 農村 / 都市        |                                                   |
| area                          | 面積                      |                                                   |
| relief                        | 地形起伏                  |                                                   |
| relief pool / relief set      | 地形プール / 地形セット   |                                                   |
| relief rule                   | 地形ルール                |                                                   |
| contours / hachures           | 等高線 / 斜線             |                                                   |
| marker / marker type          | マーカー / マーカーの種類 |                                                   |
| pin (marker shape)            | ピン                      |                                                   |
| label                         | ラベル                    |                                                   |
| label group                   | ラベルグループ            |                                                   |
| zone                          | ゾーン                    |                                                   |
| emblem, COA                   | 紋章                      | heraldic arms                                     |
| charge / tincture / field     | 図像 / 色彩 / 地色        | heraldic terms                                    |
| shield                        | 盾                        |                                                   |
| note / legend                 | メモ / 凡例               |                                                   |
| submap                        | サブマップ                |                                                   |
| neutral lands                 | 中立地                    |                                                   |
| expansionism                  | 拡張主義                  |                                                   |
| full name / short name        | 正式名 / 短縮名           | “名前” for people; places and things use “名称”   |
| state form / province form    | 国家の形態 / 州の形態     |                                                   |
| origin (culture, religion)    | 起源                      |                                                   |
| deity / believers             | 神格 / 信者               |                                                   |
| folk / organized religion     | 民間信仰 / 組織宗教       |                                                   |
| cult / heresy                 | カルト / 異端             |                                                   |

## Politics, military, economy

| English                      | Japanese                |
| ---------------------------- | ----------------------- |
| diplomacy / relations        | 外交 / 関係              |
| ally / friendly / neutral    | 同盟 / 友好 / 中立       |
| suspicion / rival / enemy    | 警戒 / ライバル / 敵     |
| vassal / suzerain            | 従属国 / 宗主国          |
| military (forces)            | 軍事 / 軍勢             |
| regiment                     | 連隊                    |
| army / fleet                 | 陸軍 / 艦隊             |
| unit (military)              | 兵種                    |
| unit (measure)               | 単位                    |
| crew                         | 乗組員                  |
| battle / attacker / defender | 戦闘 / 攻撃側 / 防御側   |
| journey / segment / stay     | 旅 / 区間 / 滞在         |
| transport type / domain      | 輸送手段 / 移動領域      |
| market                       | 市場                    |
| good / goods                 | 商品 / 商品              |
| raw / manufactured good      | 原材料 / 製品            |
| recipe / ingredient          | レシピ / 材料           |
| production                   | 生産                    |
| stock                        | 在庫                    |
| demand / demand coverage     | 需要 / 需要充足率        |
| deal / trade                 | 取引 / 貿易             |
| price / base price           | 価格 / 基準価格          |
| wealth / gross product       | 富 / 総生産              |
| treasury                     | 国庫                    |
| sales tax / poll tax         | 売上税 / 人頭税          |

## Interface

| English                        | Japanese                               |
| ------------------------------ | -------------------------------------- |
| layer                          | レイヤー                               |
| style / style element          | スタイル / スタイル要素                 |
| preset (style) / layers preset | プリセット / レイヤープリセット         |
| options / settings             | オプション / 設定                      |
| tools / editor / overview      | ツール / エディター / 一覧              |
| chart / hierarchy              | グラフ / 階層                          |
| generate                       | 生成 (a new map)                       |
| regenerate                     | 再生成; “作り直す” for one name         |
| lock / unlock                  | ロック / ロック解除                    |
| locked / unlocked              | ロック中 / ロックなし                  |
| undo / redo                    | 元に戻す / やり直す                    |
| toggle                         | 切り替え                               |
| save / load                    | 保存 / 読み込み                        |
| download / upload              | ダウンロード / アップロード            |
| export / import                | エクスポート / インポート              |
| icon / custom icon             | アイコン / カスタムアイコン            |
| custom (font, name, scheme)    | カスタム                               |
| brush / stroke (brush)         | ブラシ                                 |
| opacity / stroke / fill        | 不透明度 / 線 / 塗り                   |
| scale bar / compass rose       | スケールバー / 方位記号                 |
| measurer, ruler                | 定規                                   |
| preview                        | プレビュー                             |
| zoom / pan                     | ズーム / パン                          |
| Azgaar Assistant               | アズガル・アシスタント                  |
| chat / provider / API key      | チャット / プロバイダー / APIキー       |
