# Pioneer DDJ-SX2 MIDI Mapping for Mixxx

based on hrudham's DDJ-SR mapping, with lots of modifications to make it work on the SX2 and support most of its features.

# how do I use it?

you need **Mixxx 2.4 or newer** (developed against 2.5). for Mixxx 2.3, use an older commit of this repository.

1. clone this repository, or download it as a zip.
2. copy **every file in `bin/`** (one `.midi.xml` and four `.js` files) to the `controllers` folder inside your [Mixxx settings directory](https://manual.mixxx.org/2.5/en/chapters/appendix/settings_directory) (create it if missing):
  - Windows: `%LOCALAPPDATA%\Mixxx\controllers`
  - Linux: `~/.mixxx/controllers` (Flatpak: `~/.var/app/org.mixxx.Mixxx/.mixxx/controllers`)
  - macOS: `~/Library/Containers/org.mixxx.mixxx/Data/Library/Application Support/Mixxx/controllers`
3. make sure your Pioneer DDJ-SX2 is plugged in and turned on.
4. open (or restart) Mixxx, select the mapping in Preferences > Controllers, and enjoy using your controller

## controller setup

the DDJ-SX2 uses a SysEx to go into Serato mode, so we trick the controller into "this is Serato". no extra setup is involved.

the mapping's options (Serato mode, what the jog wheel center light shows) are in Preferences > Controllers > Pioneer DDJ-SX2.

**do not set your SX2 to MIDI mode**. certain features such as needle position, beat indicator and slip flash are not available in MIDI mode.

# differences between SX2 and Mixxx

since the DDJ-SX2 is geared towards usage with Serato DJ, some buttons have been mapped to different behavior in Mixxx. read [MANUAL.md](MANUAL.md) for more information.

# what if I have an SX, or SX3?

it *may* work. I haven't tested it, but it may work.
[here's a fork of an earlier version of this repo](https://github.com/ardje/Mixxx-Pioneer-DDJ-SX3) which modifies this mapping to work on the SX3.

# what about an SZ/SZ2?

it *might* work but many features will be missing.

# what if I have a different Pioneer DJ controller?

it's very likely that it won't work. newer controllers are totally different.

# are you going to upstream this?

not yet - it still needs some work before that can happen:

- some functions are unoptimized (for example, triggering samplers may result in some lag).
- the Flip buttons are mapped to key shift, but that's not what they're supposed to do.
- some lights turn off when pressing Shift.
- sampler pads missing the ability to load in new samples.
- it doesn't use Mixxx's Components library like most upstream mappings do.
- there may be some other things I probably missed.

# I found a bug.

awesome! go to the "Issues" section, and create an issue.

# I want to help.

you can fork this repository, clone it, install this mapping, and modify it using Mixxx and your favorite text editor. then copy the changes back to cloned repo, and commit.

where things are:
- `bin/PIONEER_DDJ-SX2.midi.xml`: buttons and knobs that map straight to a Mixxx control, plus the user settings.
- `bin/PIONEER_DDJ-SX2-scripts.js`: settings, state, init/shutdown and the table binding every scripted button (`bindInputs`).
- `bin/PIONEER_DDJ-SX2-lights.js`: LEDs. `-controls.js`: deck, effect, browser and jog wheel buttons. `-pads.js`: performance pads.

before committing, run (needs Node.js):

```
npm install
npm test       # loads the mapping into a fake Mixxx and presses every mapped control
npm run lint   # Mixxx's own ESLint rules
```

make a pull request when done.
