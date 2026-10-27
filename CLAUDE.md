# Working on tinta

`tinta` sets the X desktop's palette, light or dark, in the `_TINTA`
property on the root window. A raz port of the Pascal `~/lib/tinta`
(frozen) with the same CLI, output, messages and exit codes. Read
`README.md` first. Follow `~/r/CLAUDE.md` and `~/r/raz/STANDARDS.md`.

## Tooling and checks

A personal project: `sauce` for version control, `git` as a mirror,
`robbie` for tasks, `concha` for scripts. It builds over rx11's Xlib,
which raz finds in `~/.raz/lib`.

    robbie               # build/tinta
    robbie check         # Paleta's own test, tinta on an Xvfb, the manuals
    robbie fmt           # src/ as Pretty.raz writes it
    robbie loc           # lines of code, by rloc
    robbie cast          # doc/demo.cast and doc/img/demo.gif, by rat -gif
    robbie install       # tinta and its manuals into ~/.local, Paleta into ~/.raz/lib

`robbie check` and `robbie fmt` must pass before every commit.

## The code

- `src/Paleta.raz`: the palettes and the property's encoding. No X
  calls; its `main` is its test. `robbie install` puts it in
  `~/.raz/lib`, where raz finds it.
- `src/Tinta.raz`: the program, over Xlib.

## How we work

- The property's bytes and the program's output are a contract with
  the Pascal programs (pt, tiza, arnold, the pgc games), which read
  the same property; change them only together.
- rat (`Palette.raz`) and mosaico (`Mpalette.raz`) keep their own
  copies of the decoding; a change to the layout updates them too.
- A change to a command or behaviour updates `doc/tinta.1`,
  `doc/paleta.3` and `README.md` in the same commit.
