# Emblems

States, provinces and burgs can show a **heraldic emblem** or a **picture emblem**. A heraldic emblem is drawn from a coat of arms (COA): a field, charges and tinctures. Any icon from the [Icon Library](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons) can be a charge, including your own image, an emoji or a goods icon. A picture emblem shows one image whole, with no field.

Open _Tools_ → _Emblems_ or click an emblem on the map to edit it. The _Regenerate_ button returns a picture emblem to a generated coat of arms. _Map size_ and dragging on the map work for both kinds.

The expected way to edit an emblem is [Armoria](https://azgaar.github.io/Armoria/) and its COA string: a COA is a short text, so it keeps the `.map` file small and the emblem stays editable. Use uploaded pictures sparingly, as each one is stored in the `.map` file and increases its size.

## Work with Armoria

_Edit in Armoria_ opens the current COA in Armoria. A linked Armoria picture opens its original COA. When Armoria was opened from the Generator, every change you make there, including undo, redo and recoloured tinctures, shows on that emblem a moment later. If the art is not available in the Generator, Armoria's picture is stored as one Custom icon, so it still shows offline.

The link button in the Emblems Editor opens a field holding the emblem's COA string. Edit it by hand, or replace it with an Armoria _Copy edit link_, _Copy API link_ or _Copy COA string_, and press _Apply_; the emblem keeps its size and place on the map. When the Generator knows all of its art, the COA stays heraldic and can be edited again. If it contains art the Generator lacks, it links Armoria's SVG render as a picture. The field takes only these Armoria formats; for any other image use the picture buttons.

## Use a picture

The Emblems Editor has two picture buttons, both opening the icon picker on _Custom_. The knight button sets the emblem's charge; the upload button replaces the whole emblem with the picture, which suits a ready coat of arms, flag, badge or seal that Armoria cannot make. Choose an existing icon, paste an image link, or upload an SVG, PNG, JPEG or WebP file. The picker accepts SVGs up to 1 MB and rasters up to 10 MB, shrinking larger raster dimensions to 1024 px. A charge picture becomes the emblem's main charge: _Field_ and _Charge_ set their tinctures and _Charge size_ scales the charge. These controls appear only for emblems made from a library picture; any other coat of arms is edited in Armoria. Pictures with open colours and line art take the charge tincture; raster images keep their own colours.

_Shape_ appears for pictures and emblems made from a library picture; a coat of arms changes its shield in Armoria. _Shape_ → _None_ also shows the current charge alone, without a field. Choosing a shape for a whole picture puts it on a field as the charge. _Position_ in the icon picker zooms or moves a Custom icon inside its frame; _Replace_ changes every emblem, marker or other place using that icon. A state and its capital can use the same Custom icon, stored once in the map, so reuse an uploaded picture rather than uploading it again. Removing a Custom icon tells you how many emblems and other places use it. Armoria cannot show Icon Library pictures, so they are missing when such an emblem is opened there.

Uploaded pictures are saved in the `.map` file and show offline, but they make the file larger, especially rasters. Linked pictures keep the file small but need their host. Emblem SVG and raster downloads include the built-in and Custom icon art they use; a linked picture appears in raster exports only if its host allows the Generator to read it.
