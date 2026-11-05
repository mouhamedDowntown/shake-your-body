{ pkgs, lib, ... }:

# Dev environment for Bouge: the web app (Node) and the desktop app (Tauri:
# Rust + WebKitGTK). Enter it with `devenv shell`, or run `devenv up` to start
# the desktop app directly.
let
  # WebKitGTK plays sound (the break chime) through GStreamer; without these
  # plugins the web process fails as soon as the chime plays
  gstPlugins = with pkgs.gst_all_1; [ gstreamer gst-plugins-base gst-plugins-good ];

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
    # COSMIC panel applet (libcosmic / wgpu)
    wayland
    libxkbcommon
    vulkan-loader
    libGL
    fontconfig
    freetype
    expat
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
  ] ++ runtimeLibs ++ gstPlugins;

  env = {
    LD_LIBRARY_PATH = lib.makeLibraryPath runtimeLibs;
    # HTTPS inside the webview
    GIO_MODULE_DIR = "${pkgs.glib-networking}/lib/gio/modules/";
    # Nix's WebKitGTK can't use the host GPU drivers on a non-NixOS system;
    # these fall back to software rendering instead of a blank window
    WEBKIT_DISABLE_DMABUF_RENDERER = "1";
    GST_PLUGIN_SYSTEM_PATH_1_0 = lib.makeSearchPathOutput "lib" "lib/gstreamer-1.0" gstPlugins;
  };

  processes.desktop.exec = "npm run tauri dev";

  # Build Bouge + the COSMIC panel applet and install both into ~/.local
  # (no sudo). The binaries link against Nix libraries, so each gets a small
  # wrapper script that sets the library paths from this environment.
  scripts.install-desktop.exec = ''
    set -e
    mkdir -p ~/.local/bin ~/.local/share/applications

    wrap() { # wrap <name> <binary>
      install -m755 "$2" ~/.local/bin/"$1"-bin
      {
        echo '#!/bin/sh'
        echo "export LD_LIBRARY_PATH='$LD_LIBRARY_PATH'"
        echo "export GIO_MODULE_DIR='$GIO_MODULE_DIR'"
        echo "export GST_PLUGIN_SYSTEM_PATH_1_0='$GST_PLUGIN_SYSTEM_PATH_1_0'"
        echo "export WEBKIT_DISABLE_DMABUF_RENDERER=1"
        echo "exec \"\$HOME/.local/bin/$1-bin\" \"\$@\""
      } > ~/.local/bin/"$1"
      chmod +x ~/.local/bin/"$1"
    }

    cd "$DEVENV_ROOT"
    npm run tauri build -- --no-bundle
    wrap bouge src-tauri/target/release/bouge

    cd "$DEVENV_ROOT/cosmic-applet"
    cargo build --release
    wrap bouge-cosmic-applet target/release/bouge-cosmic-applet
    sed "s|@BIN@|$HOME/.local/bin/bouge-cosmic-applet|" app.bouge.CosmicApplet.desktop \
      > ~/.local/share/applications/app.bouge.CosmicApplet.desktop

    echo "Installed ~/.local/bin/bouge and the Bouge COSMIC applet."
    echo "Add the applet in COSMIC Settings → Desktop → Panel → Applets (or restart the panel)."
  '';

  enterShell = ''
    echo "Bouge dev env — npm run dev (web) · npm run tauri dev (desktop)"
  '';
}
