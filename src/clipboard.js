/**
 * Read clipboard only from a direct user-triggered action.
 * Never persist, log or return browser permission error details: they may
 * contain environment-specific, sensitive text.
 */
export async function readClipboardText(clipboard) {
  if (!clipboard || typeof clipboard.readText !== "function") {
    return {ok:false,reason:"unsupported"};
  }
  try {
    // This call must execute before any other await to preserve user activation.
    const text = await clipboard.readText();
    if (typeof text !== "string" || !text.trim()) {
      return {ok:false,reason:"empty"};
    }
    return {ok:true,text};
  } catch {
    return {ok:false,reason:"blocked"};
  }
}
