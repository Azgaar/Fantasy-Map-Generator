<qgis styleCategories="Symbology" version="3.28.0">
  <renderer-v2 type="RuleRenderer">
    <rules>
      <rule filter="regexp_match(&quot;icon&quot;, '^https?://|^data:')" symbol="0" label="Image icon"/>
      <rule filter="NOT regexp_match(&quot;icon&quot;, '^https?://|^data:')" symbol="1" label="Emoji/character icon"/>
    </rules>
    <symbols>
      <!-- Image-based icons (URL or data URI). QGIS will try to load the image path from the 'icon' attribute. -->
      <symbol type="marker" name="0">
        <layer class="RasterImageMarker">
          <prop k="size" v="3"/>
          <data_defined_properties>
            <Option type="Map">
              <Option name="properties" type="Map">
                <Option name="imageFile" type="Map">
                  <Option name="active" type="bool" value="true"/>
                  <Option name="expression" type="QString" value="attribute('icon')"/>
                  <Option name="type" type="int" value="3"/>
                </Option>
                <Option name="size" type="Map">
                  <Option name="active" type="bool" value="true"/>
                  <Option name="expression" type="QString" value="coalesce(attribute('size'), 3)"/>
                  <Option name="type" type="int" value="3"/>
                </Option>
              </Option>
              <Option name="type" type="int" value="2"/>
            </Option>
          </data_defined_properties>
        </layer>
      </symbol>

      <!-- Emoji/character-based icons: use label rendering for full emoji support.
           Keep symbol invisible to avoid double-drawing; labels will show the emoji. -->
      <symbol type="marker" name="1">
        <layer class="SimpleMarker">
          <prop k="name" v="circle"/>
          <prop k="size" v="0"/>
          <prop k="color" v="0,0,0,0"/>
          <prop k="outline_color" v="0,0,0,0"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
  <!-- Rule-based labels to render emojis from the 'icon' attribute.
       This path supports multi-codepoint and non-BMP emoji (e.g., 💧). -->
  <labeling type="rule-based">
    <rules>
      <rule filter="NOT regexp_match(&quot;icon&quot;, '^https?://|^data:')">
        <settings>
          <text-style field="icon" fontFamily="Noto Color Emoji" fontSize="9" isExpression="0"/>
          <text-buffer bufferDraw="0"/>
        </settings>
      </rule>
    </rules>
  </labeling>
</qgis>
