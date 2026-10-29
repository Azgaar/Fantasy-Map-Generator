// Messages the model and the renderers have for the user: they cannot import the UI, so the UI listens
type NoticeType = "info" | "success" | "warn" | "error";
type Listener = (message: string, type: NoticeType, time: number) => void;
type Notice = Parameters<Listener>;

let listener: Listener | null = null;
const pending: Notice[] = []; // sent before the UI listened

/** Tell the user something; `time` clears it after that many ms */
export function notify(message: string, type: NoticeType = "info", time = 0): void {
  if (listener) listener(message, type, time);
  else pending.push([message, type, time]);
}

/** The UI shows the notices: `ui/tooltips` registers the one listener */
export function onNotice(next: Listener): void {
  listener = next;
  for (const notice of pending.splice(0)) next(...notice);
}
