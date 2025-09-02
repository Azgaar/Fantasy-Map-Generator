<qgis styleCategories="Symbology" version="3.28.0">
  <renderer-v2 type="RuleRenderer">
    <rules>
      <rule filter="&quot;type&quot; IN ('majorSea','regional') OR &quot;group&quot; = 'searoutes'" symbol="0" label="Sea routes"/>
      <rule filter="&quot;type&quot; = 'royal' OR (&quot;group&quot; = 'roads' AND coalesce(&quot;type&quot;,'')='')" symbol="1" label="Royal road"/>
      <rule filter="&quot;type&quot; = 'market'" symbol="2" label="Market road"/>
      <rule filter="&quot;type&quot; = 'local' OR &quot;group&quot; = 'secondary'" symbol="3" label="Local road"/>
      <rule filter="&quot;type&quot; = 'footpath' OR &quot;group&quot; = 'trails'" symbol="4" label="Footpath"/>
      <rule else="1" symbol="5" label="Other"/>
    </rules>
    <symbols>
      <symbol type="line" name="0">
        <layer class="SimpleLine">
          <prop k="line_color" v="0,137,202,200"/>
          <prop k="line_width" v="0.8"/>
          <prop k="customdash" v="6;2"/>
          <prop k="use_custom_dash" v="1"/>
          <prop k="capstyle" v="round"/>
          <prop k="joinstyle" v="round"/>
        </layer>
      </symbol>
      <symbol type="line" name="1">
        <layer class="SimpleLine">
          <prop k="line_color" v="159,81,34,255"/>
          <prop k="line_width" v="1.2"/>
          <prop k="capstyle" v="round"/>
          <prop k="joinstyle" v="round"/>
        </layer>
      </symbol>
      <symbol type="line" name="2">
        <layer class="SimpleLine">
          <prop k="line_color" v="159,81,34,220"/>
          <prop k="line_width" v="1.0"/>
          <prop k="customdash" v="4;2"/>
          <prop k="use_custom_dash" v="1"/>
          <prop k="capstyle" v="round"/>
          <prop k="joinstyle" v="round"/>
        </layer>
      </symbol>
      <symbol type="line" name="3">
        <layer class="SimpleLine">
          <prop k="line_color" v="159,81,34,180"/>
          <prop k="line_width" v="0.8"/>
          <prop k="customdash" v="2;2"/>
          <prop k="use_custom_dash" v="1"/>
          <prop k="capstyle" v="round"/>
          <prop k="joinstyle" v="round"/>
        </layer>
      </symbol>
      <symbol type="line" name="4">
        <layer class="SimpleLine">
          <prop k="line_color" v="120,120,120,200"/>
          <prop k="line_width" v="0.5"/>
          <prop k="customdash" v="1;2"/>
          <prop k="use_custom_dash" v="1"/>
          <prop k="capstyle" v="round"/>
          <prop k="joinstyle" v="round"/>
        </layer>
      </symbol>
      <symbol type="line" name="5">
        <layer class="SimpleLine">
          <prop k="line_color" v="0,0,0,150"/>
          <prop k="line_width" v="0.6"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>
