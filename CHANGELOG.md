# spaniel Changelog

### 3.0.0 (December 16, 2016)

Fix `rootMargin` [sign bug](https://github.com/linkedin/spaniel/issues/24). Positive `rootMargin` values should expand the offset. This is a breaking change for anyone currently setting `rootMargin`.

### 2.1.0 (November 17, 2016)

Add api for one-time determining an element's viewport state

* `elementSatisfiesRatio()`
* `queryElement()`

### 2.0.0 (November 11, 2016)

#### Breaking changes

* Remove default `time` value for `Watcher` constructor option. `impressed` and `impression-complete` will no longer fire without `time` option.
* Remove default `ratio` value for `Watcher` constructor option. `visible` will no longer fire without `ratio` option.

### 1.1.0 (November 8, 2016)

Add public utility API

* `scheduleRead()`
* `scheduleWork()`
* `on()`
* `setGlobalEngine()`

### 1.0.0 (September 29, 2016)

Initial open source release
