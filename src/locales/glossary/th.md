# Thai glossary

Terms every `th.json` string uses the same way. Rules for all catalogs are in
[docs/architecture/translation.md](../../../docs/architecture/translation.md).

## Style

- No pronoun for the user; polite particles (ครับ/ค่ะ) are not used. Questions: “ต้องการลบหรือไม่”.
- Thai has no spaces between words: spaces separate phrases only, and none around a Latin word or number that sits inside Thai text unless the English has one.
- Buttons and menu items are the verb or a noun: “บันทึกแผนที่”, “ลบทั้งหมด”.
- Tooltips are “คลิกเพื่อ…” or a noun phrase.
- Quotes are “ ”. Keys keep Latin names: Ctrl, Shift, Alt, Enter, Esc.
- Brand and product names stay Latin: Azgaar, Armoria, Dropbox, Discord.
- The product names are translated: “โปรแกรมสร้างแผนที่แฟนตาซี”, in full “โปรแกรมสร้างแผนที่แฟนตาซีของ Azgaar”; the assistant is “ผู้ช่วย Azgaar”.
- Keep labels short for narrow menu tabs.

## Map

| English                         | Thai                             | Note                                          |
| ------------------------------- | -------------------------------- | --------------------------------------------- |
| map                             | แผนที่                           |                                               |
| burg                            | ชุมชน                            | any settlement                                |
| capital                         | เมืองหลวง                        |                                               |
| port                            | ท่าเรือ                          |                                               |
| state                           | รัฐ                              |                                               |
| province                        | จังหวัด                          |                                               |
| culture                         | วัฒนธรรม                         |                                               |
| religion                        | ศาสนา                            |                                               |
| namesbase                       | ฐานชื่อ                          |                                               |
| heightmap                       | แผนที่ความสูง                    |                                               |
| template (heightmap)            | แม่แบบ                           |                                               |
| cell                            | เซลล์                            |                                               |
| grid                            | ตาราง                            |                                               |
| seed                            | ซีด                              |                                               |
| biome                           | ไบโอม                            |                                               |
| feature (island, lake…)         | ลักษณะภูมิประเทศ                 |                                               |
| continent / island / isle       | ทวีป / เกาะ / เกาะเล็ก           |                                               |
| lake / sea / ocean / gulf       | ทะเลสาบ / ทะเล / มหาสมุทร / อ่าว |                                               |
| coastline / coast / shore       | แนวชายฝั่ง / ชายฝั่ง / ชายหาด    |                                               |
| river / source / mouth          | แม่น้ำ / ต้นน้ำ / ปากแม่น้ำ      |                                               |
| route / road / trail / sea lane | เส้นทาง / ถนน / ทางเดิน / เส้นทางเดินเรือ |                                      |
| elevation, height / depth       | ความสูง / ความลึก                |                                               |
| precipitation                   | ปริมาณฝน                         |                                               |
| temperature                     | อุณหภูมิ                         |                                               |
| population / rural / urban      | ประชากร / ชนบท / เมือง           |                                               |
| relief                          | ภูมิประเทศนูน                    |                                               |
| relief pool / relief rule       | กลุ่มภูมิประเทศนูน / กฎภูมิประเทศนูน |                                           |
| marker                          | เครื่องหมาย                      |                                               |
| label / added label             | ป้ายชื่อ / ป้ายชื่อเพิ่มเอง      |                                               |
| label group                     | กลุ่มป้ายชื่อ                    |                                               |
| zone                            | โซน                              |                                               |
| emblem / coat of arms           | ตราสัญลักษณ์                     |                                               |
| charge / tincture / field       | ลวดลาย / สี / พื้นโล่            | heraldic terms                                |
| division / ordinary             | การแบ่งโล่ / ลายหลัก             |                                               |
| note / legend                   | บันทึก / คำอธิบายสัญลักษณ์       |                                               |
| submap                          | แผนที่ย่อย                       |                                               |
| neutrals / wildlands            | not translated                   | map content                                   |

## Politics, military, economy

| English                         | Thai                             |
| ------------------------------- | -------------------------------- |
| diplomacy                       | การทูต                           |
| ally / enemy / vassal / suzerain | พันธมิตร / ศัตรู / เมืองขึ้น / รัฐเจ้าอธิราช |
| state form                      | รูปแบบการปกครอง                  |
| military / regiment             | กองทัพ / กรม                     |
| army / fleet / navy             | กองทัพบก / กองเรือ / กองทัพเรือ  |
| unit (military)                 | หน่วย                            |
| battle / attacker / defender    | การรบ / ฝ่ายโจมตี / ฝ่ายป้องกัน   |
| journey / segment / stay        | การเดินทาง / ช่วง / การพัก       |
| transport type                  | ประเภทการขนส่ง                   |
| market                          | ตลาด                             |
| good / goods                    | สินค้า                           |
| raw / manufactured good         | วัตถุดิบ / สินค้าผลิต            |
| recipe                          | สูตร                             |
| production                      | การผลิต                          |
| stock                           | สต็อก                            |
| demand / supply                 | อุปสงค์ / อุปทาน                 |
| deal / trade                    | ข้อตกลง / การค้า                 |
| treasury                        | คลัง                             |
| sales tax / poll tax            | ภาษีการขาย / ภาษีรายหัว          |

## Interface

| English                         | Thai                             |
| ------------------------------- | -------------------------------- |
| layer                           | เลเยอร์                          |
| style / style element           | สไตล์ / องค์ประกอบสไตล์          |
| preset                          | ค่าที่ตั้งไว้ล่วงหน้า            |
| options / settings              | ตัวเลือก / การตั้งค่า            |
| tools / editor / overview       | เครื่องมือ / ตัวแก้ไข / ภาพรวม   |
| generate / regenerate           | สร้าง / สร้างใหม่                |
| lock / unlock                   | ล็อก / ปลดล็อก                   |
| undo / redo                     | เลิกทำ / ทำซ้ำ                   |
| toggle (a layer)                | แสดง / ซ่อน                      |
| save / load                     | บันทึก / เปิด                    |
| download / upload               | ดาวน์โหลด / อัปโหลด              |
| export / import                 | ส่งออก / นำเข้า                  |
| icon / icon set                 | ไอคอน / ชุดไอคอน                 |
| custom icon / icon library      | ไอคอนกำหนดเอง / คลังไอคอน        |
| glyph                           | กลีฟ                             |
| brush                           | แปรง                             |
| opacity / stroke / fill         | ความทึบ / เส้น / สีเติม          |
| scale bar / compass rose        | แถบมาตราส่วน / เข็มทิศ           |
| Azgaar Assistant                | ผู้ช่วย Azgaar                   |
| chat / proposal / tier          | แชต / ข้อเสนอ / ระดับ            |
| guest / member / key            | ผู้เยี่ยมชม / สมาชิก / คีย์      |
| provider                        | ผู้ให้บริการ                     |
