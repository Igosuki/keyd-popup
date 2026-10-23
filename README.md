# Keyd Leader Popup

A GNOME Shell extension that shows a which-key style panel at the bottom of the screen while a [keyd](https://github.com/rvaiya/keyd) layer is active. It runs `keyd listen` itself and reads the bindings and their labels straight from your keyd config, so there is nothing else to install or keep in sync.

Supports GNOME Shell 45 to 50.

## Requirements

- keyd installed and running (`sudo systemctl enable --now keyd`).
- Your user in the `keyd` group, which `keyd listen` needs:

  ```sh
  sudo usermod -aG keyd $USER
  ```

  Log out and back in afterwards so the session picks up the group.

## Labelling bindings

The comment line directly above a mapping becomes its label in the panel. Mappings without a comment show their raw keyd action. A blank line or any other line in between drops the label. Mappings that enter another layer (`oneshot(x)`, `toggle(x)`, `swap(x)`, `layer(x)`) are highlighted as nested groups.

```ini
[ids]
*

[main]
rightalt = oneshot(leader)

[leader]
# Firefox
f = C-A-S-f1
# Terminal
t = C-A-S-f2
```

After editing, reload keyd with `sudo keyd reload` (`sudo keyd.rvaiya reload` on Debian and Ubuntu). The extension picks up config changes on its own.

To make the leader outputs do something, bind each one to a command in Settings → Keyboard → Custom Shortcuts. For example, bind Ctrl+Alt+Shift+F1 to `firefox`.

## Install

From [extensions.gnome.org](https://extensions.gnome.org/) (link coming once published), or from source:

```sh
make install
```

On Wayland, log out and back in, then enable it with `gnome-extensions enable keyd-popup@igosuki.github.io` or the Extensions app.

## Settings

Open the preferences from the Extensions app, or run `gnome-extensions prefs keyd-popup@igosuki.github.io`.

| Setting | Default | |
|---|---|---|
| Config file | `/etc/keyd/default.conf` | keyd config to read layers and labels from. Only this one file is read, so layers defined in other `/etc/keyd/*.conf` files get no panel |
| Ignored layers | `main ids global control shift alt meta altgr` | layers that never show the panel |
| Rows per column | 8 | items per column before wrapping |
| Bottom margin | 96 | pixels from the bottom of the primary monitor |
| Hide timeout | 6 | seconds before the panel hides if a release event is missed |

Changes apply immediately.

## Troubleshooting

The extension logs keyd errors, such as a missing binary, a missing `keyd` group, or an unreadable config, to the shell's journal:

```sh
journalctl --user -b -o cat /usr/bin/gnome-shell | grep -i keyd
```

Check that keyd emits layer events for your user. Pressing the leader key should print `+leader` and `-leader`:

```sh
keyd listen          # keyd.rvaiya listen on Debian and Ubuntu
```

## Development

```sh
make test    # parser tests, needs gjs
make pack    # builds dist/keyd-popup@igosuki.github.io.shell-extension.zip
make install
```

Try it in a nested shell without logging out. On GNOME 49 and later:

```sh
dbus-run-session gnome-shell --devkit --wayland
```

On older versions:

```sh
dbus-run-session gnome-shell --nested --wayland
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
