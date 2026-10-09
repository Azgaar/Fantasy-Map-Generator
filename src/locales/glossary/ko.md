# Korean glossary

Terms every `ko.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- Buttons and menu items are the noun or the verb stem: “저장”, “불러오기”, “모두 삭제”.
- Tooltips take “~하려면 클릭” or a noun phrase: “클릭하여 마커 변경”, “클릭하여 정렬”.
- Confirmations are polite questions: “삭제하시겠습니까?”. Prose uses the formal polite ending “-습니다”.
- Dialog titles and editors name the thing: “~ 편집기”, “~ 개요”; inline actions use “편집”, “변경”.
- Quotes are “ ” as in English. Keep half-width punctuation with a trailing space; no 。.
- Particles follow the noun directly; a Latin word or `{{placeholder}}` is followed by a particle that fits either ending (“은(는)” is avoided: reword with a noun phrase).
- Keys keep Latin names: Ctrl, Shift, Alt, Enter, Esc, Space. Join them with “ + ”.
- Brand and product names stay Latin: FMG, Armoria, Dropbox, Discord, Google, Azgaar. The product is “Azgaar의 판타지 지도 생성기”, the assistant “Azgaar 어시스턴트”.
- Keep labels short for narrow menu tabs; drop a word before dropping a meaning.

## Map

| English                       | Korean              | Note                                     |
| ----------------------------- | ------------------- | ---------------------------------------- |
| map                           | 지도                |                                          |
| burg                          | 도시                | any settlement                           |
| capital                       | 수도                | a province's is “주도”                   |
| port                          | 항구                |                                          |
| state                         | 국가                |                                          |
| province                      | 주                  |                                          |
| culture                       | 문화                |                                          |
| religion                      | 종교                |                                          |
| namesbase                     | 이름 데이터베이스   | the tab and the culture field are “이름” |
| heightmap                     | 높이맵              | the layer is “높이”                      |
| template (heightmap)          | 템플릿              |                                          |
| cell                          | 셀                  |                                          |
| grid                          | 격자                |                                          |
| seed                          | 시드                |                                          |
| biome                         | 바이옴              |                                          |
| feature (island, lake…)       | 지형                |                                          |
| continent / island / isle     | 대륙 / 섬 / 작은 섬 |                                          |
| lake / sea / ocean / gulf     | 호수 / 바다 / 대양 / 만 |                                      |
| freshwater / salt lake        | 담수호 / 염호       |                                          |
| coastline / coast             | 해안선 / 해안       |                                          |
| river / source / mouth        | 강 / 발원지 / 하구  |                                          |
| route / road / off-road       | 경로 / 도로 / 비포장 |                                         |
| elevation, height / depth     | 고도 / 깊이         |                                          |
| sea level                     | 해수면              |                                          |
| precipitation                 | 강수량              |                                          |
| temperature                   | 기온                |                                          |
| population / rural / urban    | 인구 / 농촌 / 도시  |                                          |
| area                          | 면적                |                                          |
| relief                        | 기복                |                                          |
| contours / hachures           | 등고선 / 해칭       |                                          |
| marker / marker type          | 마커 / 마커 유형    |                                          |
| label / label group           | 라벨 / 라벨 그룹    |                                          |
| zone                          | 구역                |                                          |
| emblem, COA                   | 문장                | heraldic arms                            |
| charge / tincture / field     | 문양 / 색조 / 바탕  | heraldic terms                           |
| shield                        | 방패                |                                          |
| note / legend                 | 메모 / 범례         |                                          |
| submap                        | 서브맵              |                                          |
| neutral lands                 | 중립 지역           |                                          |
| expansionism                  | 팽창주의            |                                          |
| full name / short name        | 정식 명칭 / 약칭    |                                          |
| state form / province form    | 국가 형태 / 주 형태 |                                          |
| origin                        | 기원                |                                          |
| deity / believers             | 신 / 신자           |                                          |
| folk / organized religion     | 민속 신앙 / 조직 종교 |                                        |
| cult / heresy                 | 컬트 / 이단         |                                          |

## Politics, military, economy

| English                      | Korean               |
| ---------------------------- | -------------------- |
| diplomacy / relations        | 외교 / 관계          |
| ally / friendly / neutral    | 동맹 / 우호 / 중립   |
| suspicion / rival / enemy    | 의심 / 라이벌 / 적   |
| vassal / suzerain            | 속국 / 종주국        |
| military / regiment          | 군사 / 연대          |
| army / fleet                 | 육군 / 함대          |
| unit (military) / (measure)  | 병종 / 단위          |
| battle / attacker / defender | 전투 / 공격측 / 방어측 |
| journey / segment / stay     | 여정 / 구간 / 체류   |
| market                       | 시장                 |
| good / goods                 | 상품                 |
| raw / manufactured good      | 원자재 / 제품        |
| recipe / ingredient          | 레시피 / 재료        |
| production / stock / demand  | 생산 / 재고 / 수요   |
| trade / price / wealth       | 무역 / 가격 / 부     |
| treasury                     | 국고                 |
| sales tax / poll tax         | 판매세 / 인두세      |

## Interface

| English                        | Korean                          |
| ------------------------------ | ------------------------------- |
| layer                          | 레이어                          |
| style / preset                 | 스타일 / 프리셋                 |
| options / settings             | 옵션 / 설정                     |
| tools / editor / overview      | 도구 / 편집기 / 개요            |
| chart / hierarchy              | 차트 / 계층                     |
| generate / regenerate          | 생성 / 다시 생성                |
| lock / unlock                  | 잠금 / 잠금 해제                |
| undo / redo                    | 실행 취소 / 다시 실행           |
| toggle                         | 전환                            |
| save / load                    | 저장 / 불러오기                 |
| download / upload              | 다운로드 / 업로드               |
| export / import                | 내보내기 / 가져오기             |
| icon / custom                  | 아이콘 / 사용자 지정            |
| opacity / stroke / fill        | 불투명도 / 선 / 채우기          |
| scale bar / compass rose       | 축척 막대 / 나침반 도안         |
| ruler                          | 자                              |
| preview / zoom / pan           | 미리보기 / 확대·축소 / 이동     |
| chat / provider / API key      | 채팅 / 제공자 / API 키          |
