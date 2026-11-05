{ pkgs, lib, ... }:

# Dev environment for Bouge: the web app (Node) and the desktop app (Tauri:
# Rust + WebKitGTK). Enter it with `devenv shell`, or run `devenv up` to start
# the desktop app directly.
let
  # Libraries Tauri loads at runtime (the tray icon is dlopen'ed)
  runtimeLibs = with pkgs; [
    webkitgtk_4_1
    gtk3
    cairo
    gdk-pixbuf
    glib
    dbus
    openssl
    librsvg
    libsoup_3
    libayatana-appindicator
  ];
in
{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    npm.enable = true;
    npm.install.enable = true;
  };

  languages.rust.enable = true;

  packages = with pkgs; [
    pkg-config
    gobject-introspection
    xdotool
    at-spi2-atk
    harfbuzz
    pango
  ] ++ runtimeLibs;

  env = {
    LD_LIBRARY_PATH = lib.makeLibraryPath runtimeLibs;
    # HTTPS inside the webview
    GIO_MODULE_DIR = "${pkgs.glib-networking}/lib/gio/modules/";
    # Nix's WebKitGTK can't use the host GPU drivers on a non-NixOS system;
    # these fall back to software rendering instead of a blank window
    WEBKIT_DISABLE_DMABUF_RENDERER = "1";
  };

  processes.desktop.exec = "npm run tauri dev";

  enterShell = ''
    echo "Bouge dev env — npm run dev (web) · npm run tauri dev (desktop)"
  '';
}
