# freehander

a tool for creating freehand point-n-click html games.

### element

each element (text, doodle, image) can be positioned and skewed.
- to manipulate a vertex, simply click and drag it.
- to manipulate an edge, simply click and drag it.
- hold shift for more control over these manipulations.

### slide

a game is a collection of slides that contain elements. subslides can be created by insetting a slide underneath its superslide. subslides appear visually layered atop superslides, making them useful for creating reusable backdrops.

### script

scripting is done using javascript.

available script commands:
- goto(slide_path);
- await seconds(seconds) / await s(seconds);
- await click();
- show(element_path);
- hide(element_path);

#### pathing

path syntax is important. relative paths (e.g. "slide1/element1") start searching among children (subslides, elements) of the current slide. to go to a sibling of the current slide, prepend "../" to the path. absolute paths (e.g. "/slide1/element1") can also be used, in which searches start among root slides.

### style

styling is done with css.

everything inside the `@scope { }` block contains the styles within the given slide (and its elements & subslides).

within a `@scope { }` block, `:scope` can be used as a selector for the given slide.

### play, load, save, export

you can test the game in the browser by clicking "play".

you can load and save your project using the respective "load", "save" buttons in the "game" menu.

you can build your game by clicking "export". the resulting archive contains an index.html file that is identical to the file produced by the "save" function.
