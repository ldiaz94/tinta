# Working on tinta

`tinta` sets the X desktop's palette, light or dark, in the `_TINTA`
property on the root window, and shows a notification saying which. A raz port of the Pascal `~/lib/tinta`
(frozen) with the same CLI, output, messages and exit codes. Read
`README.md` first. Follow `~/r/CLAUDE.md` and `~/r/raz/STANDARDS.md`.

## Tooling and checks

A personal project: `sauce` for version control, `git` as a mirror,
`robbie` for tasks, `concha` for scripts. It builds over rx11's Xlib, from
rx11's checkout beside this directory (`-I ../rx11/src`; `robbie
rx11=...` names another), and over rdbus's Dbus for the notification
(`-I ../rdbus/src`, `robbie rdbus=...`), with `RAZ_PATH` empty so that raz never sees
`~/.raz/lib`, where a second Paleta would clash.

    robbie               # build/tinta
    robbie check         # Paleta's own test, tinta on an Xvfb and a private bus, the manuals
    robbie fmt           # src/ as Pretty.raz writes it
    robbie loc           # lines of code, by rloc
    robbie cast          # doc/demo.cast and doc/img/demo.gif, by rat -gif
    robbie install       # tinta and its manuals into ~/.local, a plain copy of Paleta into ~/.raz/lib

`robbie check` and `robbie fmt` must pass before every commit.

## The code

- `src/Paleta.raz`: the palettes and the property's encoding. No X
  calls; its `main` is its test. `robbie install` puts a plain
  copy in `~/.raz/lib`, where raz finds it.
- `src/Tinta.raz`: the program, over Xlib.
- `src/TintaNotify.raz`: the notification, over rdbus's `Dbus`. Its id
  is kept in the `_TINTA_NOTE` root property. `robbie check` needs
  `dbus-run-session` and `dbus-monitor`, and no test may reach the
  desktop's bus.

## How we work

- The property's bytes and the program's output are a contract with
  the Pascal programs (pt, tiza, arnold, the pgc games), which read
  the same property; change them only together.
- rat and mosaico import the installed Paleta. A change to it is
  installed with `robbie install`, and rat and mosaico are rebuilt.
- A change to a command or behaviour updates `doc/tinta.1`,
  `doc/paleta.3` and `README.md` in the same commit.
