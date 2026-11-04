// Always-on-top mini window via the Document Picture-in-Picture API
// (Chrome / Edge 116+). It floats above every other app, so the move bubble
// is visible even when the browser isn't the active window.

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>;
      window: Window | null;
    };
  }
}

export function pipSupported() {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

/** Must be called from a user gesture (click, key press). */
export async function openPip(width = 340, height = 460): Promise<Window | null> {
  if (!pipSupported()) return null;
  const existing = window.documentPictureInPicture!.window;
  if (existing) return existing;

  const pip = await window.documentPictureInPicture!.requestWindow({ width, height });
  copyStyles(pip.document);
  pip.document.title = "Bouge";
  return pip;
}

function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement("style");
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      target.head.appendChild(style);
    } catch {
      // cross-origin sheet: link it instead
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}
