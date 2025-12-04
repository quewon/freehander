# freehander

a tool for creating freehand point-n-click html games.

### element

each element is (text, doodle, image) can be positioned and skewed.
- to manipulate a vertex or edge, simply click and drag it.
- hold shift for more control over these manipulations.
- inspect or double click an element to edit its html content.
- right click an element to send it to the back. (shift click to prevent changing the element's depth position.)

### slide

a game is a collection of slides that contain elements. subslides can be created by insetting a slide underneath its superslide. subslides appear visually layered atop superslides, making them useful for creating reusable backdrops.

### script

scripting is done using javascript.

available script commands:
- goto(slide_path);
- await seconds(seconds) / await s(seconds);
- await click();
    - note: this awaits not only a player's mouse click, but spacebar input as well.
- show(element_path);
- hide(element_path);

these functions are also tied to the global window.game variable. if you want to call them from an embedded html file (iframe), use [window.top.game](https://developer.mozilla.org/en-US/docs/Web/API/Window/top).

#### pathing

path syntax is important. relative paths (e.g. "slide1/element1") start searching among children (subslides, elements) of the current slide. to go to a sibling of the current slide, prepend "../" to the path. absolute paths (e.g. "/slide1/element1") can also be used, in which searches start among root slides.

### style

styling is done with css.

everything inside the `@scope { }` block contains the styles within the given slide (and its elements & subslides). within a @scope  block, `:scope` can be used as a selector for the given slide.

note: although @scope works on many major browsers, current and older versions of firefox don't support it! if you want to support these browsers, you can instead put all of your styling code into the topmost slide, outside of a @scope block.

### play, load, save, export

you can test the game in the browser by clicking "play".

you can load and save your project using the respective "load", "save" buttons in the "game" menu.

you can build your game by clicking "export". the resulting archive contains an index.html file that is identical to the file produced by the "save" function.

### media

you can import a local folder containing media assets to use in your game.

when you load a saved html file that contains imported media, it attempts to access the loaded media folder to search for its file. note that if you change the name of your media folder, or any files within it, any references to it will be broken and you will need to manually edit the path of these elements or add them again.

### keyboard shortcuts

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
| code > add indent | tab (requires focus on code input area) |
| code > toggle comment | meta+/ |
| code > tab out | escape, then tab out |

* "meta" refers to control (ctrl) on Windows and command (⌘) on macOS.