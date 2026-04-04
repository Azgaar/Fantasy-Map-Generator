/**
 * Generates public/lang/ja-tip-map.js from public/lang/tips-en.json
 * Run: node scripts/build-ja-tip-map.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tipsPath = path.join(root, "public/lang/tips-en.json");
const outPath = path.join(root, "public/lang/ja-tip-map.js");

const tips = JSON.parse(fs.readFileSync(tipsPath, "utf8"));

const layerToggle =
  "：クリックで表示の切り替え、ドラッグでレイヤー順を変更。Ctrl+クリックでスタイルを編集";

const layerNames = {
  "Texture overlay": "テクスチャオーバーレイ",
  Heightmap: "ハイトマップ",
  Biomes: "バイオーム",
  "Cells structure": "セル構造",
  Grid: "グリッド",
  "Coordinate grid": "座標グリッド",
  "Wind (Compass) Rose": "方位（コンパス）ローズ",
  Rivers: "河川",
  "Relief and biome icons": "起伏・バイオームアイコン",
  Religions: "宗教",
  Cultures: "文化",
  States: "国家",
  Provinces: "州・属州",
  Zones: "ゾーン",
  "State borders": "国境",
  "Trade routes": "交易路",
  Temperature: "気温",
  Population: "人口",
  "Icebergs and glaciers": "氷山・氷河",
  Precipitation: "降水量",
  Emblems: "紋章",
  "Burg icons": "都市アイコン",
  Labels: "ラベル",
  "Military forces": "軍事力",
  Markers: "マーカー",
  Rulers: "定規",
  "Scale Bar": "縮尺バー",
  "Vignette (border fading)": "ビネット（縁のフェード）",
  "Military map": "軍事マップ",
  "Population map": "人口マップ",
  "Precipitation map": "降水量マップ",
  "Temperature map": "気温マップ"
};

const openTargets = {
  "Biomes Editor": "バイオーム編集",
  "Burgs Overview": "都市一覧",
  "Cell details view": "セル詳細",
  "Charts to overview cells data": "セルデータのチャート",
  "Cultures Editor": "文化編集",
  "Diplomatical relationships Editor": "外交関係編集",
  "Emblem Editor": "紋章編集",
  "Heightmap customization menu": "ハイトマップ調整メニュー",
  "Markers Overview": "マーカー一覧",
  "Military Forces Overview": "軍一覧",
  "Namesbase Editor": "名前ベース編集",
  "Notes Editor": "ノート編集",
  "Provinces Editor": "州編集",
  "Religions Editor": "宗教編集",
  "Rivers Overview": "河川一覧",
  "Routes Overview": "ルート一覧",
  "States Editor": "国家編集",
  "Units Editor": "ユニット編集",
  "Zones Editor": "ゾーン編集",
  "style editor": "スタイルエディタ",
  "tools menu": "ツールメニュー",
  "world configurator to setup map position on Globe and World climate":
    "世界設定（地球位置・気候）",
  "Image Converter": "画像変換",
  "Template Editor Tutorial": "テンプレートエディタのチュートリアル",
  "Battle Simulation Tutorial": "戦闘シミュレーションのチュートリアル",
  "Military Forces Tutorial": "軍事力のチュートリアル",
  "route creation dialog": "ルート作成ダイアログ",
  "template editor": "テンプレートエディタ",
  "burg map in a new tab": "都市マップを新しいタブで開く",
  "previously downloaded style file": "以前ダウンロードしたスタイルファイル",
  "previously downloaded template": "以前ダウンロードしたテンプレート"
};

const manual = {
  "Activate/deactivate group": "グループの有効／無効",
  "Add a custom biome": "カスタムバイオームを追加",
  "Add a font": "フォントを追加",
  "Add a new burg. Hold Shift to add multiple": "新しい都市を追加。Shiftを押しながらで複数追加",
  "Add a new marker. Hold Shift to add multiple": "新しいマーカーを追加。Shiftを押しながらで複数追加",
  "Add a new province. Hold Shift to add multiple": "新しい州を追加。Shiftを押しながらで複数追加",
  "Add additional marker of that type": "同じ種類のマーカーを追加",
  "Add an Iceberg (click on map)": "氷山を追加（地図をクリック）",
  "Add new Regiment": "新しい連隊を追加",
  "Add new namesbase": "新しい名前ベースを追加",
  "Add new zone layer": "新しいゾーンレイヤーを追加",
  "Add or subtract value from all heights in range": "範囲内のすべての標高に値を加算／減算",
  "Add regiment to the battle": "戦闘に連隊を追加",
  "Add route group": "ルートグループを追加",
  "Align brush: drag to set height of cells in radius to height of the cell at mousepoint":
    "整列ブラシ：ドラッグで半径内セルの高さをマウス位置のセルに合わせる",
  "Allow brush to change only land cells and hence restrict the coastline modification":
    "陸セルのみ変更し海岸線の改変を制限",
  "Allow system to apply filter automatically based on zoom level": "ズームに応じてフィルタを自動適用",
  "Allow system to hide emblem groups if their size in too small or too big on that scale":
    "スケールに対して紋章グループが小さすぎ／大きすぎなら非表示",
  "Allow system to hide labels if their size in too small or too big on that scale":
    "スケールに対してラベルが小さすぎ／大きすぎなら非表示",
  "Allow system to rescale labels on zoom": "ズーム時にラベルを再スケール",
  "Allow to drag map beyond canvas borders": "キャンバス外まで地図をドラッグ可能にする",
  "Apply a filter": "フィルタを適用",
  "Apply assignment": "割り当てを適用",
  "Apply current assignment": "現在の割り当てを適用",
  "Analyze namesbase to get a validity and quality overview": "名前ベースの妥当性・品質を分析",
  "Attach regiment to another one (include this regiment to another one)":
    "別の連隊に合併（この連隊を他に含める）",
  "Attack foreign regiment": "敵連隊を攻撃",
  "Auto-assign colors based on hue (good for colored images)": "色相で色を自動割当（カラー画像向け）",
  "Auto-assign colors based on liminosity (good for monochrome images)":
    "輝度で色を自動割当（モノクロ画像向け）",
  "Auto-assign colors using generator scheme (for exported colored heightmaps)":
    "ジェネレータ配色で自動割当（カラーハイトマップ向け）",
  "Automatically add river starting from clicked cell. Hold Shift to add multiple":
    "クリックしたセルから河川を自動追加。Shiftで複数",
  "Cancel assignment": "割り当てをキャンセル",
  "Cancel the conversion. Previous heightmap will be restored": "変換を中止し直前のハイトマップに戻す",
  "Cancel the creation": "作成をキャンセル",
  "Canvas size. Can be changed in general options on new map generation":
    "キャンバスサイズ。新規マップ生成時の一般オプションで変更",
  "Change Iceberg size": "氷山のサイズを変更",
  "Change brush power": "ブラシの強さを変更",
  "Change brush size. Shortcut: + to increase; – to decrease":
    "ブラシサイズ。ショートカット：+で拡大、−で縮小",
  "Change height for all cells": "すべてのセルの標高を変更",
  "Change tool power. Shortcut: + to increase; – to decrease":
    "ツールの強さ。ショートカット：+で増、−で減",
  "Check if unit is separate and can be stacked only with units of the same type":
    "ユニットが独立し同種のみ積み重ね可能か",
  "Check to fit burg styles (icon and label size) to the submap scale":
    "サブマップ縮尺に都市スタイル（アイコン・ラベル）を合わせる",
  "Check to not allow system to automatically hide labels": "システムのラベル自動非表示を無効化",
  "Check to render ocean heights": "海洋の標高も描画する",
  "Click and provide a URL to image to be set as a texture":
    "クリックしてテクスチャ画像のURLを指定",
  "Click on a control point to split the route there": "制御点をクリックしてその位置でルートを分割",
  "Click on map to place a burg. Hold Shift to add multiple":
    "地図をクリックして都市を配置。Shiftで複数",
  "Click on map to place a marker. Hold Shift to add multiple":
    "地図をクリックしてマーカーを配置。Shiftで複数",
  "Click on map to place a river. Hold Shift to add multiple":
    "地図をクリックして河川を配置。Shiftで複数",
  "Click on map to place label. Hold Shift to add multiple":
    "地図をクリックしてラベルを配置。Shiftで複数",
  "Click to add a custom heightmap color scheme": "クリックでカスタムハイトマップ配色を追加",
  "Click to add custom province form name to the list": "クリックで州の政体名をリストに追加",
  "Click to add custom state form name to the list": "クリックで国家の政体名をリストに追加",
  "Click to change generation and UI options": "クリックで生成・UIオプションを変更",
  "Click to change map layers": "クリックでマップレイヤーを変更",
  "Click to change wind direction": "クリックで風向を変更",
  "Click to generate a new map": "クリックで新しいマップを生成",
  "Click to generate a submap from the current viewport": "クリックで現在の表示範囲からサブマップを生成",
  "Click to hide the Menu": "クリックでメニューを隠す",
  "Click to invert lock state for all markers": "クリックですべてのマーカーのロック状態を反転",
  "Click to invert pin state for all markers": "クリックですべてのマーカーのピン状態を反転",
  "Click to join the route to another route that starts or ends at the same cell":
    "クリックで同じセルで接続する別ルートに結合",
  "Click to perform an operation": "クリックで操作を実行",
  "Click to place a linear measurer (ruler)": "クリックで線形計測（定規）を配置",
  "Click to re-generate full name": "クリックで正式名称を再生成",
  "Click to recalculate military forces based on current military options":
    "クリックで現在の軍事オプションに基づき軍を再計算",
  "Click to recalculate rural and urban population": "クリックで農村・都市人口を再計算",
  "Click to regenerate all emblems": "クリックですべての紋章を再生成",
  "Click to regenerate all relief icons based on current cell biome and elevation":
    "クリックで現在のバイオーム・標高に基づき起伏アイコンを再生成",
  "Click to regenerate all rivers (restore default state)": "クリックですべての河川を再生成（初期状態）",
  "Click to regenerate all unlocked burgs and routes. States will remain as they are. Note: burgs are only generated in populated areas with culture assigned":
    "ロック解除された都市とルートを再生成。国家は維持。都市は文化のある人口地域にのみ生成されます",
  "Click to regenerate all unlocked routes": "クリックでロック解除されたルートをすべて再生成",
  "Click to regenerate icebergs and glaciers": "クリックで氷山・氷河を再生成",
  "Click to regenerate non-locked cultures": "クリックでロックされていない文化を再生成",
  "Click to regenerate non-locked provinces. States will remain as they are":
    "クリックでロックされていない州を再生成。国家は維持",
  "Click to regenerate non-locked religions": "クリックでロックされていない宗教を再生成",
  "Click to regenerate non-locked states. Emblems and military forces will be regenerated as well, burgs will remain as they are, but capitals will be different":
    "クリックでロックされていない国家を再生成。紋章・軍も再生成。都市は残りますが首都は変わります",
  "Click to regenerate unlocked markers": "クリックでロック解除されたマーカーを再生成",
  "Click to regenerate zones. Hold Ctrl and click to set zones number multiplier":
    "クリックでゾーンを再生成。Ctrl+クリックでゾーン数の倍率を設定",
  "Click to remove current custom preset": "クリックで現在のカスタムプリセットを削除",
  "Click to remove current custom style preset": "クリックで現在のカスタムスタイルを削除",
  "Click to restore default (Earth-based) wind directions": "クリックで既定（地球基準）の風向に戻す",
  "Click to restore default options and reload the page": "クリックで既定オプションに戻して再読み込み",
  "Click to restore regiment's default name": "クリックで連隊名を既定に戻す",
  "Click to save current style as a new preset": "クリックで現在のスタイルを新規プリセットとして保存",
  "Click to save displayed layers as a new preset": "クリックで表示中のレイヤーを新規プリセットとして保存",
  "Click to see Generator info": "クリックでジェネレータ情報を表示",
  "Click to see list of supporters": "クリックでサポーター一覧を表示",
  "Click to see the usage instructions": "クリックで使い方を表示",
  "Click to set map size to cover the Northern latitudes": "クリックで北半球緯度をカバーするマップサイズに",
  "Click to set map size to cover the Southern latitudes": "クリックで南半球緯度をカバーするマップサイズに",
  "Click to set map size to cover the Tropical latitudes": "クリックで熱帯緯度をカバーするマップサイズに",
  "Click to set map size to cover the whole world": "クリックで全世界をカバーするマップサイズに",
  "Click to set number multiplier": "クリックで数の倍率を設定",
  "Click to show the Menu": "クリックでメニューを表示",
  "Click to skip the step": "クリックでこの手順をスキップ",
  "Click to toggle a layer, drag to raise or lower a layer. Ctrl + click to edit layer style":
    "クリックでレイヤーの表示切替、ドラッグで順序変更。Ctrl+クリックでスタイル編集",
  "Click to toggle the removal mode on brush dragging": "クリックでブラシドラッグ時の削除モードを切替",
  "Click to transform the map": "クリックでマップを変形",
  "Click to update state labels placement based on current borders":
    "クリックで現在の国境に基づき国家ラベル位置を更新",
  "Complete river creation": "河川の作成を完了",
  "Complete route creation": "ルートの作成を完了",
  "Complete the conversion. All unassigned colors will be considered as ocean":
    "変換を完了。未割当の色はすべて海洋として扱います",
  "Config markers generation options": "マーカー生成オプションを設定",
  "Configure burg groups": "都市グループを設定",
  "Configure world and map size and climate settings": "世界・マップサイズ・気候を設定",
  "Connect your Dropbox account to be able to load maps from it":
    "Dropboxに接続してマップを読み込めるようにする",
  "Copy link to the clipboard": "リンクをクリップボードにコピー",
  "Copy map seed as URL. It will produce the same map only if options are default or the same":
    "マップシードをURLとしてコピー。オプションが既定または同一のときのみ同じマップになります",
  "Copy selected relief icon": "選択した起伏アイコンをコピー",
  "Create a new group for this coastline": "この海岸線の新しいグループを作成",
  "Create a new group for this label": "このラベルの新しいグループを作成",
  "Create a new regiment or fleet": "新しい連隊または艦隊を作成",
  "Create a new river selecting river cells": "河川セルを選択して新しい河川を作成",
  "Create a new route selecting route cells": "ルートセルを選択して新しいルートを作成",
  "Create a new type (group) for the lake": "湖の新しい種類（グループ）を作成",
  "Create custom province form name": "カスタムの州の政体名を作成",
  "Defenders morale: ": "防御側の士気：",
  "Attackers morale: ": "攻撃側の士気：",
  "Depress brush: drag to gradually decrease height of cells in radius by Power value":
    "下押しブラシ：ドラッグで半径内の標高を徐々に下げる",
  "Depression depth to form a new lake. Increase to reduce number of lakes added by system":
    "新しい湖を形成する陥没の深さ。大きくするとシステムが追加する湖の数が減る",
  "Descrease font": "フォントを小さく",
  "Display brushes panel": "ブラシパネルを表示",
  "Disrupt (randomize) heights a bit": "標高を少し乱す（ランダム化）",
  "Disrupt brush: drag to randomize height of cells in radius based on Power value":
    "撹乱ブラシ：ドラッグで半径内の標高を強さに応じてランダム化",
  "Drag to measure a curve length (opisometer)": "ドラッグで曲線の長さを計測（オピソメータ）",
  "Drag to measure a curve length that sticks to routes (route opisometer)":
    "ドラッグでルートに沿った曲線長を計測",
  "Drag to measure a polygon area (planimeter)": "ドラッグで多角形の面積を計測（プラニメータ）",
  "Drag to move the Menu": "ドラッグでメニューを移動",
  "Drag to move the pane": "ドラッグでペインを移動",
  "Drag to reorder": "ドラッグで並べ替え",
  "Edit Military units": "軍事ユニットを編集",
  "Elevation profile": "標高プロファイル",
  "Enter API key. Note: the Generator doesn't store the key or any generated data":
    "APIキーを入力。ジェネレータはキーや生成データを保存しません",
  "Enter custom form name": "カスタムの政体名を入力",
  "Enter style preset name": "スタイルプリセット名を入力",
  "Equirectangular projection is used: distortion is maximum on poles. Use map with aspect ratio 2:1 for best result":
    "正距円筒図法を使用。極で歪み最大。2:1の縦横比が最適です",
  "Examples. Click to re-generate": "例。クリックで再生成",
  "Execute the template": "テンプレートを実行",
  "Fantasy world Meridian length relative to real-world Earth (20k km)":
    "空想世界の子午線長（実地球2万kmとの比）",
  "Filter by name or group": "名前またはグループで絞り込み",
  "Filter by name, province, state, culture, or group":
    "名前・州・国家・文化・グループで絞り込み",
  "Filter by name, type or basin": "名前・種類・流域で絞り込み",
  "Filter by type": "種類で絞り込み",
  "Finalize the heightmap and exit the edit mode": "ハイトマップを確定して編集モードを終了",
  "Find or share custom namesbase on Cartography Assets portal":
    "Cartography Assetsで名前ベースを共有・検索",
  "Find or share custom style preset on Cartography Assets portal":
    "Cartography Assetsでスタイルプリセットを共有・検索",
  "Find or share custom template on Cartography Assets portal":
    "Cartography Assetsでテンプレートを共有・検索",
  "Focus on selected object": "選択したオブジェクトにフォーカス",
  "Generate a new map based on options": "オプションに基づき新しいマップを生成",
  "Generate culture-specific name": "文化に合わせた名前を生成",
  "Generate random name": "ランダムな名前を生成",
  "Generate route name": "ルート名を生成",
  "Heightmap edit mode": "ハイトマップ編集モード",
  "Hide rescaler": "リスケーラーを隠す",
  "Hide rescaler slider": "リスケーラースライダーを隠す",
  "Hide style edit section": "スタイル編集欄を隠す",
  "Increase font": "フォントを大きく",
  "Invert heightmap along the axes": "軸に沿ってハイトマップを反転",
  "Iterate battle": "戦闘を進行",
  "Join Discord server": "Discordサーバーに参加",
  "Load Google Translate and select language. Note that automatic translation can break some page functional. In this case reset the language back to English or refresh the page":
    "Google翻訳を読み込み言語を選択。自動翻訳で不具合が出たら英語に戻すかページを再読み込みしてください",
  "Load fully-functional map (.map or .gz formats)": "完全なマップを読み込み（.map または .gz）",
  "Load image to convert": "変換する画像を読み込み",
  "Load map file (.map or .gz) file from URL. Note that the server should allow CORS":
    "URLからマップ（.map/.gz）を読み込み。サーバーはCORSを許可する必要があります",
  "Load map file (.map or .gz) from your Dropbox": "Dropboxからマップ（.map/.gz）を読み込み",
  "Load map file (.map or .gz) from your local disk": "ローカルからマップ（.map/.gz）を読み込み",
  "Load map from browser storage (if saved before)": "ブラウザ保存からマップを読み込み（保存済みの場合）",
  "Lock or unlock all burgs": "すべての都市をロック／解除",
  "Lock or unlock all routes": "すべてのルートをロック／解除",
  "Lock seed (click on lock icon) if you want template to generate the same heightmap each time":
    "毎回同じハイトマップにするにはシードをロック（鍵アイコン）",
  "Lower brush: drag to decrease height of cells in radius by Power value":
    "下げブラシ：ドラッグで半径内の標高を強さ分だけ下げる",
  "Manually re-assign biomes to not follow the default moisture/temperature pattern":
    "既定の水分・気温パターンに従わないようバイオームを手動再割当",
  "Manually re-assign provinces": "州を手動で再割当",
  "Map coordinates on globe": "地球上のマップ座標",
  "Map generation settings. Generate a new map to apply the settings":
    "マップ生成設定。新規生成で反映されます",
  "Map presentation in 3D scene. Works best for heightmap. Cannot be used for editing":
    "3Dシーンでの表示。ハイトマップ向け。編集には使えません",
  "Map seed number. Press 'Enter' to apply. Seed produces the same map only if canvas size and options are the same":
    "マップシード。Enterで適用。キャンバスサイズとオプションが同じときのみ同じマップになります",
  "Open wiki article scale and distance to know about grid scale":
    "縮尺と距離のウィキ記事を開く（グリッド縮尺について）",
  "Pin fill and stroke colors": "塗りと線の色を固定",
  "Pin it": "ピン留め",
  "Preview heightmap in 3D scene": "3Dシーンでハイトマップをプレビュー",
  "Project map on globe. Cannot be used for editing": "地球にマップを投影。編集不可",
  "Provide a name for the new group": "新しいグループの名前を入力",
  "Redo the action": "やり直す",
  "Redo the action (Ctrl + Y)": "やり直す（Ctrl + Y）",
  "Refresh the Editor": "エディタを更新",
  "Refresh the Overview screen": "一覧画面を更新",
  "Refresh the overview screen": "一覧画面を更新",
  "Regenerate diplomatical relations": "外交関係を再生成",
  "Regenerate emblem": "紋章を再生成",
  "Regenerate era": "時代を再生成",
  "Regenerate map name": "マップ名を再生成",
  "Reset language to English": "言語を英語にリセット",
  "Reset map zoom": "マップズームをリセット",
  "Restore default canvas size": "既定のキャンバスサイズに戻す",
  "Restore default namesbase": "既定の名前ベースに戻す",
  "Restore default theme color: pale magenta": "既定テーマ色（淡いマゼンタ）に戻す",
  "Restore default units settings": "既定のユニット設定に戻す",
  "Restore default zoom extent: [1, 20]": "既定ズーム範囲 [1, 20] に戻す",
  "Speak the examples. You can change voice and language in options":
    "例を読み上げ。音声・言語はオプションで変更",
  "Speak the name. You can change voice and language in options":
    "名前を読み上げ。音声・言語はオプションで変更",
  "Standard view mode that allows to edit the map": "地図を編集できる標準表示モード",
  "The selected layer is not visible. Toogle it on to see style changes effect":
    "選択したレイヤーが非表示です。表示するとスタイル変更が確認できます",
  "Tool settings that don't affect maps. Changes are getting applied immediately":
    "マップに影響しないツール設定。変更はすぐ反映されます",
  "Tweet": "ツイート",
  "Type to change the label. Enter \"|\" to move to a new line":
    "ラベルを入力。「|」で改行",
  "Undo the latest action": "直前の操作を取り消す",
  "Undo the latest action (Ctrl + Z)": "直前の操作を取り消す（Ctrl + Z）",
  "Update the scene": "シーンを更新",
  "Upload notes from PC": "PCからノートをアップロード",
  "Download map file to your local disk": "マップファイルをローカルにダウンロード",
  "Save fully-functional map file": "完全なマップファイルを保存",
  "Save the project to browser storage only": "プロジェクトをブラウザ保存のみ",
  "Download full data in JSON": "全データをJSONでダウンロード",
  "Download minimal data in JSON": "最小データをJSONでダウンロード",
  "Load map from browser storage (if saved before)": "ブラウザ保存からマップを読み込み",
  "Dominant culture in the province. This defines culture-based naming. Can be changed via the Cultures Editor":
    "州の主流文化。文化に基づく命名に影響。文化編集で変更可能",
  "Evaporation from lake surface. If evaporation > supply, the lake water is saline. If difference is high, the lake becomes dry":
    "湖面からの蒸発。蒸発＞給水なら塩湖。差が大きいと干潟化",
  "If height is greater or equal to X and less or equal to Y, then perform an operation Z with operand V":
    "標高がX以上Y以下のとき、操作ZとオペランドVを実行",
  "Image scale relative to image size (e.g. 5x)": "画像サイズに対する倍率（例：5倍）",
  "Increases the polygon count to smooth the sharp points. Please note that it can take some time to calculate":
    "ポリゴン数を増やして角を滑らかに。計算に時間がかかる場合があります",
  "Landing: amphibious attack": "上陸：両棲攻撃",
  "Landmass area in selected units": "陸地面積（選択した単位）",
  "Layers reduction rate. Increase to improve performance": "レイヤー削減率。大きくすると性能向上",
  "Line simplification rate. Increase to slightly improve performance": "線の単純化率。大きくするとやや軽量化",
  "Markers number": "マーカー数",
  "Multiply all heights in range by factor": "範囲内のすべての標高を係数倍",
  "Names data: a comma separated list of source names used for names generation":
    "名前データ：名前生成に使う元名のカンマ区切りリスト",
  "Place icons in a bulk": "アイコンを一括配置",
  "Populate with letters that can be used twice in a row (geminates)":
    "連続して使える文字を指定（重複子音など）",
  "Raise brush: increase height of cells in radius by Power value":
    "上げブラシ：半径内のセル標高を強さ分だけ上げる",
  "Re-generate examples based on provided data": "入力データに基づき例を再生成",
  "Route length in selected units": "ルートの長さ（選択した単位）",
  "Uncheck to not update state label on name change": "チェックを外すと名前変更時に国家ラベルを更新しない",
  "Zoom map and center view in the burg": "マップをズームし都市を中央に表示"
};

function translateLayerToggle(s) {
  const m = s.match(
    /^(.+): click to toggle, drag to raise or lower the layer\. Ctrl \+ click to edit layer style$/
  );
  if (!m) return null;
  const jp = layerNames[m[1]] || m[1];
  return jp + layerToggle;
}

function translateGridToggle(s) {
  if (
    s ===
    "Grid: click to toggle, drag to raise or lower. Ctrl + click to edit layer style and select type"
  ) {
    return "グリッド：クリックで表示の切り替え、ドラッグで順序変更。Ctrl+クリックでスタイルと種類を編集";
  }
  return null;
}

function translateRulers(s) {
  if (
    s ===
    "Rulers: click to toggle, drag to move, click on label to delete. Ctrl + click to edit layer style"
  ) {
    return "定規：クリックで表示の切り替え、ドラッグで移動、ラベルクリックで削除。Ctrl+クリックでスタイル編集";
  }
  return null;
}

function translateScaleBar(s) {
  if (s === "Scale Bar: click to toggle. Ctrl + click to edit style") {
    return "縮尺バー：クリックで表示の切り替え。Ctrl+クリックでスタイル編集";
  }
  return null;
}

function translateVignette(s) {
  if (s === "Vignette (border fading): click to toggle. Ctrl + click to edit style") {
    return "ビネット（縁のフェード）：クリックで表示の切り替え。Ctrl+クリックでスタイル編集";
  }
  return null;
}

function translateClickToOpen(s) {
  const m = s.match(/^Click to open (.+)$/);
  if (!m) return null;
  const inner = openTargets[m[1]];
  if (!inner) return null;
  return `${inner}を開くにはクリック`;
}

const sortBySuffixJa = {
  "biome area": "バイオーム面積",
  "biome cells number": "バイオームのセル数",
  "biome habitability": "バイオームの居住適性",
  "biome name": "バイオーム名",
  "biome population": "バイオーム人口",
  "burg features": "都市の特徴",
  "burg name": "都市名",
  "burg population": "都市人口",
  "culture group": "文化グループ",
  "culture name": "文化名",
  "diplomatical relations": "外交関係",
  "discharge (flux in m3/s)": "流量（m³/s）",
  "distance to the battlefield": "戦場までの距離",
  "marker type": "マーカー種別",
  "province area": "州の面積",
  "province burgs count": "州内の都市数",
  "province capital": "州都",
  "province form name": "州の政体名",
  "province name": "州名",
  "province owner": "州の所属国家",
  "province population": "州人口",
  "regiment name": "連隊名",
  "river basin": "流域",
  "river length": "河川の長さ",
  "river mouth width": "河口幅",
  "river name": "河川名",
  "river type name": "河川タイプ名",
  "route group": "ルートグループ",
  "route length": "ルートの長さ",
  "route name": "ルート名",
  "state name": "国家名",
  "total military forces": "総軍事力"
};

function translateClickToSort(s) {
  const m = s.match(/^Click to sort by (.+)$/);
  if (!m) return null;
  const ja = sortBySuffixJa[m[1]];
  if (!ja) return null;
  return `クリックで「${ja}」でソート`;
}

function translate(s) {
  if (manual[s]) return manual[s];
  return (
    translateLayerToggle(s) ||
    translateGridToggle(s) ||
    translateRulers(s) ||
    translateScaleBar(s) ||
    translateVignette(s) ||
    translateClickToOpen(s) ||
    translateClickToSort(s) ||
    s
  );
}

const map = {};
for (const t of tips) {
  const j = translate(t);
  if (j !== t) map[t] = j;
}

const header = `// Auto-generated by scripts/build-ja-tip-map.mjs — do not edit by hand
window.FMG_JA_TIP_MAP = `;
const footer = `;
`;

fs.writeFileSync(outPath, header + JSON.stringify(map, null, 0) + footer);
const n = Object.keys(map).length;
console.log("Wrote", outPath);
console.log("Translated tooltips:", n, "of", tips.length, "(others stay English in HTML until added to script)");
