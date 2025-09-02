<qgis styleCategories="Symbology" version="3.28.0">
  <renderer-v2 type="singleSymbol">
    <symbols>
      <symbol type="fill" name="0">
        <layer class="SimpleFill">
          <prop k="color" v="255,255,0,80"/>
          <prop k="outline_color" v="0,0,0,180"/>
          <prop k="outline_width" v="0.3"/>
          <data_defined_properties>
            <Option type="Map">
              <Option name="properties" type="Map">
                <Option name="fillColor" type="Map">
                  <Option name="active" type="bool" value="true"/>
                  <Option name="expression" type="QString" value="attribute('color')"/>
                  <Option name="type" type="int" value="3"/>
                </Option>
              </Option>
              <Option name="type" type="int" value="2"/>
            </Option>
          </data_defined_properties>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
  <labeling type="rule-based">
    <rules>
      <rule>
        <settings>
          <text-style field="description" fontSize="8" namedStyle="Italic" isExpression="0"/>
          <text-buffer bufferDraw="1" bufferColor="255,255,255,255" bufferSize="0.8"/>
        </settings>
      </rule>
    </rules>
  </labeling>
</qgis>

