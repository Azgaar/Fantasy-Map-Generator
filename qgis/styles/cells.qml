<qgis styleCategories="Symbology" version="3.28.0">
  <renderer-v2 type="graduatedSymbol" attr="height" graduatedMethod="GraduatedColor" symbollevels="0">
    <ranges>
      <range symbol="0" lower="0" upper="20" label="Water (h &lt; 20)"/>
      <range symbol="1" lower="20" upper="40" label="Lowlands (20-40)"/>
      <range symbol="2" lower="40" upper="60" label="Hills (40-60)"/>
      <range symbol="3" lower="60" upper="80" label="Highlands (60-80)"/>
      <range symbol="4" lower="80" upper="200" label="Mountains (80+)"/>
    </ranges>
    <symbols>
      <symbol type="fill" name="0">
        <layer class="SimpleFill">
          <prop k="color" v="180,210,243,255"/>
          <prop k="outline_color" v="120,120,120,100"/>
          <prop k="outline_width" v="0.1"/>
        </layer>
      </symbol>
      <symbol type="fill" name="1">
        <layer class="SimpleFill">
          <prop k="color" v="196,230,188,255"/>
          <prop k="outline_color" v="120,120,120,60"/>
          <prop k="outline_width" v="0.1"/>
        </layer>
      </symbol>
      <symbol type="fill" name="2">
        <layer class="SimpleFill">
          <prop k="color" v="161,207,148,255"/>
          <prop k="outline_color" v="120,120,120,60"/>
          <prop k="outline_width" v="0.1"/>
        </layer>
      </symbol>
      <symbol type="fill" name="3">
        <layer class="SimpleFill">
          <prop k="color" v="196,183,151,255"/>
          <prop k="outline_color" v="120,120,120,80"/>
          <prop k="outline_width" v="0.1"/>
        </layer>
      </symbol>
      <symbol type="fill" name="4">
        <layer class="SimpleFill">
          <prop k="color" v="180,170,160,255"/>
          <prop k="outline_color" v="120,120,120,120"/>
          <prop k="outline_width" v="0.1"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>

