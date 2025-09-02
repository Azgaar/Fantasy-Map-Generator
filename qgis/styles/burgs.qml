<qgis styleCategories="Symbology" version="3.28.0">
  <renderer-v2 type="RuleRenderer">
    <rules>
      <rule filter="\"capital\" = 1" symbol="0" label="Capital"/>
      <rule filter="\"port\" = 1" symbol="1" label="Port town"/>
      <rule filter="\"citadel\" = 1 OR \"walls\" = 1" symbol="2" label="Fortified"/>
      <rule filter="ELSE" symbol="3" label="Town"/>
    </rules>
    <symbols>
      <symbol type="marker" name="0">
        <layer class="SimpleMarker">
          <prop k="name" v="circle"/>
          <prop k="color" v="30,30,30,255"/>
          <prop k="outline_color" v="255,255,255,255"/>
          <prop k="size" v="3"/>
        </layer>
      </symbol>
      <symbol type="marker" name="1">
        <layer class="SimpleMarker">
          <prop k="name" v="circle"/>
          <prop k="color" v="30,30,30,255"/>
          <prop k="outline_color" v="0,137,202,255"/>
          <prop k="size" v="2.5"/>
        </layer>
      </symbol>
      <symbol type="marker" name="2">
        <layer class="SimpleMarker">
          <prop k="name" v="square"/>
          <prop k="color" v="30,30,30,255"/>
          <prop k="outline_color" v="140,90,50,255"/>
          <prop k="size" v="2.3"/>
        </layer>
      </symbol>
      <symbol type="marker" name="3">
        <layer class="SimpleMarker">
          <prop k="name" v="circle"/>
          <prop k="color" v="30,30,30,220"/>
          <prop k="outline_color" v="255,255,255,180"/>
          <prop k="size" v="2"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>

