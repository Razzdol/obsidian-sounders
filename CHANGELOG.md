# Changelog

All notable changes to **Sounders** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Playback speed control from `0.5x` to `2.0x`, with persisted value for file-based tracks and a double-click reset to `1.0x`.
- Feedback button next to Add sounds — opens the Google Form to share ideas and reports.

### Changed

- Refined the player layout to show the playback speed slider and current rate label alongside the existing transport controls.
- Redesigned the track list into clickable cards with track numbering, clearer active-state highlighting, and softer action button affordances.
- Improved inline renaming so playlist titles and track titles edit in place more cleanly, while search toggle state is now reflected visually in the header.
- Drag reordering now starts from the whole track card instead of a separate grip, with safeguards to avoid accidental playback while dragging or editing.

## [1.1.0](https://github.com/Razzdol/obsidian-sounders/compare/v1.0.0...v1.1.0) - 2026-07-03

### Added

- Auto-scroll while dragging tracks: hold the grip handle and move near the top or bottom edge of the list to scroll.
- Inline rename on double-click: track title, artist (file tracks), and active playlist name.
- Custom display names are stored in `data.json` (the audio file on disk is not renamed).

### Changed

- Single-click to play a track is slightly delayed so double-click rename does not start playback.

## [1.0.0](https://github.com/Razzdol/obsidian-sounders/releases#release-1.0.0) - 2026-06-XX

### Added

- Sidebar audio player with playlists, shuffle, repeat modes, seek bar, and volume.
- Drag-and-drop track reordering.
- Import audio files or entire folders as playlists.
- Built-in preset sounds.

