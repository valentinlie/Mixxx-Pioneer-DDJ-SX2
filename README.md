# Pioneer DDJ-SX2 MIDI Mapping for Mixxx

Based on hrudham's DDJ-SR mapping, with many modifications to make it work on the SX2 and support most of its features.

## Installation

You need **Mixxx 2.4 or newer** (developed against 2.5). For Mixxx 2.3, use an older commit of this repository.

1. Clone this repository, or download it as a ZIP file.
2. Copy **every file in `bin/`** (one `.midi.xml` and four `.js` files) to the `controllers` folder inside your [Mixxx settings directory](https://manual.mixxx.org/2.5/en/chapters/appendix/settings_directory). Create the folder if it doesn't exist:
   - Windows: `%LOCALAPPDATA%\Mixxx\controllers`
   - Linux: `~/.mixxx/controllers` (Flatpak: `~/.var/app/org.mixxx.Mixxx/.mixxx/controllers`)
   - macOS: `~/Library/Containers/org.mixxx.mixxx/Data/Library/Application Support/Mixxx/controllers`
3. Make sure your Pioneer DDJ-SX2 is plugged in and turned on.
4. Open (or restart) Mixxx and select the mapping in **Preferences > Controllers**.

## Controller setup

The DDJ-SX2 switches to Serato mode when it receives a specific SysEx message, so the mapping makes the controller believe it is connected to Serato. No extra setup is needed.

The mapping's options (Serato mode and what the jog wheel center light shows) are in **Preferences > Controllers > Pioneer DDJ-SX2**.

**Do not set your SX2 to MIDI mode.** Features such as needle position, beat indicator and slip flash are not available in MIDI mode.

## Differences between Serato and Mixxx

The DDJ-SX2 is designed for Serato DJ, so some buttons behave differently in Mixxx. See [MANUAL.md](MANUAL.md) for details.

## What if I have an SX or SX3?

It *may* work, but it hasn't been tested.
[This fork of an earlier version](https://github.com/ardje/Mixxx-Pioneer-DDJ-SX3) adapts the mapping to the SX3.

## What about an SZ or SZ2?

It *might* work, but many features will be missing.

## What if I have a different Pioneer DJ controller?

It will most likely not work. Newer controllers are completely different.
