// close all dialogs except stated
export function closeDialogs(except = "#except") {
  try {
    $(".dialog:visible")
      .not(except)
      .each(function () {
        $(this).dialog("close");
      });
  } catch (error) {}
}
