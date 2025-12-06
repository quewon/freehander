# freehander

a tool for creating freehand point-n-click html games.

## contents

1. [slide](#slide)
2. [element](#element)
3. [script](#script)
    1. [script fields](#script-fields)
    2. [available script commands](#available-script-commands)
    3. [pathing](#pathing)
4. [style](#style)
5. [media](#media)
6. [play, load, save, export](#play-load-save-export)
7. [keyboard shortcuts](#keyboard-shortcuts)

## slide

a game is a collection of slides that contain elements. subslides can be created by insetting a slide underneath its superslide. subslides appear visually layered atop superslides.

## element

elements can be added by using the text and doodle functions, or by importing media.

elements can be positioned and skewed individually or as part of a selection group.
- to manipulate a vertex or edge, simply click and drag it.
- hold shift for more control over these manipulations.
- inspect or double click an element to edit its html content.
- right click an element to send it to the back.

tip: clicking or dragging an element automatically brings it to the front. hold shift to select or drag an element without changing its depth position.

## script

scripting is done with javascript within the script fields of an inspected slide or element.

### script fields

- enter script
    - runs when entering the slide.
- exit script
    - runs when exiting the slide.
- show script
    - runs whenever the element is not hidden after entering a slide, or when activated via `show()`.
- click script
    - runs whenever the element is clicked. elements with a click script will be clickable only if not hidden.

### available script commands

- `goto(slide_path)`
- `await seconds(seconds)` or `await s(seconds)`
- `await click()`
    - note: this awaits not only a player's mouse click, but spacebar input as well.
- `show(element_path)`
- `hide(element_path)`

these functions are also tied to the global `window.game` variable. if you want to call them from an embedded html file (iframe), use [`window.top.game`](https://developer.mozilla.org/en-US/docs/Web/API/Window/top).

### pathing

it's important to get your path syntax right. relative paths (e.g. `"slide1/element1"`) start searching among children (subslides, elements) of the current slide. to go to a sibling of the current slide, prepend `../` to the path. absolute paths (e.g. `"/slide1/element1"`) can also be used, in which searches start among root slides.

## style

styling is done in css within the "CSS" field of an inspected slide.

everything inside the `@scope` block contains the styles within the given slide (and its elements & subslides). within a `@scope`  block, `:scope` can be used as a selector for the given slide.

note: although [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope#css.at-rules.scope) works on many major browsers, current and older versions of firefox don't support it! if you want to support these browsers, you can instead put all of your styling code into the topmost slide, outside of a `@scope` block.

for font sizing, i recommend using `em` or `rem` as absolute values like `px` are incompatible with the game's dynamic scaling.

## media

by clicking on *media*, you can load a local folder to import external media from.

when you load a file that contains references to imported media, it attempts to access the media folder to fetch its file (the path of which is determined by the element's `data-filepath` attribute).

note that if you change the name of your media folder, or any files within it, any references to it will be broken and you will need to manually edit the path of these elements or add them again.

## play, load, save, export

you can test the game in the browser by clicking *play*.

you can load, save, and export your project from the *game* inspector in the top right. when exporting, the resulting archive contains an `index.html` file (identical to the file produced by the save function) as well as a folder containing all your imported media.

note: when exporting, if you need to include files that aren't directly referenced in an element's `data-filepath` attribute, you will have to add them yourself.

## keyboard shortcuts

| action | shortcut |
|-|-|
| play | meta+P |
| switch mode > select | 1 or S |
| switch mode > text | 2 or T |
| switch mode > doodle | 3 or D |
| save | meta+S |
| load | meta+L |
| export | meta+E |
| open/reload media folder | meta+M |
| open inspector | meta+I |
| undo | meta+Z |
| redo | meta+Y or shift+meta+Z |
| select all | meta+A |
| cut | meta+X |
| copy | meta+C |
| paste | meta+V |
| delete | delete or backspace |
| navigate slides | arrow keys (requires focus on slides) |
| inspector > add line break | shift+enter |
| inspector > add indent | tab (requires focus on inspector field) |
| inspector > toggle comment | meta+/ |
| inspector > tab out | escape, then tab out |

"meta" refers to either of the control and command (⌘) keys.