<p align="center"><img src="doc/img/banner.svg" alt="tinta: one palette for the X desktop, light or dark"></p>

# tinta

One palette for the whole X desktop, light or dark, kept where every
program can see it and be told when it changes. `tinta light` and the
terminal, the window manager's bar and borders and the drawing board
all turn light at once, without a restart; `tinta dark` and they turn
back. Switching themes on Linux is a bane because every program keeps
its own colours and nothing tells them the choice changed. This fixes
it at the root, for the programs on this desktop.

*Tinta* is ink, in Spanish; the mascot is a drop of it, half dark,
half light. tinta is a raz port of the Free Pascal tinta, with the same
commands, output, messages, exit codes and property bytes.

## See it

![tinta in a terminal](doc/img/demo.gif)

[`doc/demo.cast`](doc/demo.cast) is the asciinema recording. It is made
by `robbie cast` from [`test/cast.cn`](test/cast.cn), which runs the
real program on a private Xvfb with made-up timings, so the same steps
give the same file; `rat -gif` draws it as the GIF.

## Get it

tinta needs raz, libX11 and rx11's checkout (its Xlib binding) beside
this directory, as `~/r/rx11`; `robbie rx11=PATH` names another.
`robbie check` also needs `xvfb-run`, `xprop` and `groff`. The build
sets `RAZ_PATH` empty, so raz never sees `~/.raz/lib`, where `install`
puts a copy of Paleta that a second one would clash with.

    cd ~/r/tinta
    robbie               # build/tinta
    robbie check         # Paleta's test, tinta on a private Xvfb, the manuals
    robbie install       # tinta and its manuals into ~/.local, a copy of Paleta into ~/.raz/lib

## Learn it

| Command | What it does |
|---|---|
| `tinta` | print `dark` or `light` |
| `tinta dark` | set the theme's dark palette |
| `tinta light` | set its light one |
| `tinta toggle` | set the other mode |
| `tinta catppuccin`, `tinta duck`, `tinta cyberpunk`, `tinta phosphor` | set that theme, in the same mode |
| `tinta next` | set the next theme: catppuccin, duck, cyberpunk, phosphor, and round |
| `tinta theme` | print the theme's name |
| `tinta -h`, `--help` | print the usage |

Exit status: 0 done, 1 a usage error, 2 the display could not be
opened or the server did not keep the palette.

    $ tinta
    dark
    $ tinta light
    $ tinta
    light
    $ xprop -root _TINTA
    _TINTA(CARDINAL) = 1, 1, 6053751, 13766457, 4102954, 12548377, ...
    $ tinta toggle; tinta
    dark

In mosaico, Mod+Shift+t runs `tinta toggle`. To start every session
light, put `tinta light` in `~/.xinitrc` before `exec mosaico`. To
follow the sun roughly, from crontab:

    0 8 * * *  DISPLAY=:0 tinta light
    0 19 * * * DISPLAY=:0 tinta dark

To do something at each change, from a shell:

    xprop -root -spy _TINTA | while read -r _; do
        notify-send "tinta: $(tinta)"
    done

[`doc/tinta.1`](doc/tinta.1) is the manual, [`doc/paleta.3`](doc/paleta.3)
the module's.

## How it works

2 ideas, a module each.

**1. The palette is colours, in one property: `src/Paleta.raz`.** The
palette is 20 colours in a fixed order. Slots 0 to 15 are the ANSI
colours (black, red, green, yellow, blue, magenta, cyan, white, then
the bright eight), 16 is the foreground, 17 the background, 18 the
cursor and 19 the mark, an accent. With it goes a **mode**, dark or
light, for programs whose colours are their own.

    dark   Catppuccin Mocha's terminal palette, bright black lightened to read
    light  Catppuccin Latte's, its colours darkened to read as text
    duck   ladle's duck theme: a mallard's green and orange on a pale grey by
           day, a pond's deep teal by night
    cyberpunk  neon, hot pink above all, on violet-black by night; by day the
           same neon deepened on a pale pink-white
    phosphor   an old terminal's P1 green on black, with amber, by night; by
           day a teleprinter's green-barred fanfold paper in dark green ink

A dark palette and a light one make a **theme**; the theme and the mode
are set apart, each keeping the other. Catppuccin is the default. There are four.

The property is `_TINTA` on the root window: `CARDINAL`, format 32, 22
items, a version (1), the mode (0 dark, 1 light), then the 20 colours as
`0xRRGGBB`:

    item   0      1      2 .. 21
           +------+------+----------------------------+
           | 1    | mode | the 20 slots, 0xRRGGBB     |
           +------+------+----------------------------+

It lives as long as the X server, so a window manager's restart keeps
it. **Absent means dark**, so every program works on its own, under any
window manager or none.

It carries colours, not a theme's name. A name would have each program
keep its own table of what "latte" means. With the colours in the
property, the palettes are defined in one place, `Paleta.raz`, and a
changed palette, or a third, reaches every program without one of them
being rebuilt.

`Paleta` makes no X calls and imports only the library, so any program
reads the property with the X binding it has: `robbie install` puts a
plain copy of `Paleta.raz` in `~/.raz/lib`, where raz finds it, and a
program says `import Paleta`. A change to Paleta reaches rat and mosaico
by `robbie install` and a rebuild of each. Its `main` is its test.

**2. One writer: `src/Tinta.raz`.** Only `tinta` sets the property; the
window manager only binds a key that runs it, so there is one place to
look when a colour is wrong. It replaces the property in a single
`XChangeProperty`, so a client never reads half of a palette, then
reads it back: that round trip tells it the server has done the change
before it exits. Setting the property is the whole signal; programs
that follow it watch the root for `PropertyNotify`.

**Each program chooses how closely to follow**, in a compile-time
constant `FollowTinta`:

| follows | program | what changes |
|---|---|---|
| the colours | rat, pt | their 16 colours, foreground, background, cursor, mark; and so everything that runs in them |
| the colours | mosaico | the bar, the borders, the menu and notes |
| the mode | tiza | its toolbar and panels, and the canvas on screen; never the drawing or its exports |
| the mode | Firefox, Chromium, GTK | their own light or dark looks, and the pages' `prefers-color-scheme`; mosaico tells them through dconf and the desktop portal |
| nothing | anything with `FollowTinta = false` | |

te, htop, `ls --color` and anything else in a terminal follow without
knowing: they ask for ANSI colour 1 and the terminal decides what red
looks like. pt, tiza, arnold and the pgc games are Pascal and read the
same property unchanged. rat and mosaico import the installed Paleta
rather than carry their own copies of the decoding.

**The Xlib pitfall.** `XGetWindowProperty` returns format-32 data as C
longs, 8 bytes each on x86_64, not 4. Copy them one by one into `U32`s
before `Paleta.decode`; Xlib's buffer handed over as it is reads every
other item as zero.

## Correctness

- **Same as the Pascal tinta.** Output, messages, exit codes and the
  property's bytes were compared with the Pascal program's on Xvfb,
  byte for byte.
- **Readable in both.** The test holds every theme's palettes to WCAG 2's
  contrast ratio against their own background: 7:1 for the foreground,
  4.5:1 (what WCAG asks of ordinary text) for colours 1 to 7 and 9 to 15
  (black is exempt). Programs print "white" as ordinary text, so Latte's
  pale greys for white failed; so did every other Latte colour but red
  (3.1:1 to 4.3:1). They are darkened toward black just enough, keeping
  their hue.
- **Bad data is refused, not guessed.** A property that is too short, of
  another version or of a mode that is neither is reported, counts as
  dark, and is replaced by the next palette set.

## Tests

`robbie check` runs, in order:

- `Paleta`'s own `main`: every palette back from its numbers, bad
  numbers refused, every contrast high enough (all ratios printed);
- `build/tinta` with `-h` and `--help` without a display, a usage error
  and no display at all;
- `test/live.cn`: tinta on a private Xvfb (`-noreset`, never the
  desktop's), every command, the bytes of the property by `xprop`;
  skipped with a word if `xvfb-run` or `xprop` is missing;
- the manuals through `groff -mandoc -Tutf8 -ww -z`: no warnings.

## Size

`robbie loc` (by `rloc`):

    language    files  blank  comment  code
    raz             2     62      173   322

The program is dynamically linked to libX11, through rx11.

## Left out

- GTK and Qt themes, and browsers, except through mosaico's dconf and
  portal calls.
- Remembering the choice across logins: put `tinta light` or `tinta dark`
  in `~/.xinitrc`.
- A schedule: use cron, or mosaico, which runs `tinta light` at sunrise
  and `tinta dark` at sunset.
- More than four themes, and a configuration file.

## When to use it

Use it on this desktop, where the programs that matter read `_TINTA`.
Elsewhere, compare:

- **darkman** switches by the clock or the sun and runs scripts at each
  change. Each program is still recoloured its own way, by a script that
  edits its configuration and pokes it to reload. tinta has no schedule
  and no scripts, because the programs listen for themselves.
- **xsettingsd** sets `Net/ThemeName` and friends through XSETTINGS,
  which GTK programs follow live. It speaks of a theme's name, so each
  toolkit must have the theme installed, and terminals and window
  managers don't listen to it.
- **The desktop portal's `color-scheme`** is what GTK 4, libadwaita, Qt 6
  and browsers ask for "prefer dark". It needs D-Bus and a portal
  backend, and carries only the preference, no colours.

tinta is the smallest of the three and the only one that hands out the
colours themselves; the others reach programs it never will. They can be
used together: a script that runs `tinta dark` can also run `gsettings
set org.gnome.desktop.interface color-scheme prefer-dark`.

## Licence

ISC. See [LICENSE](LICENSE).
