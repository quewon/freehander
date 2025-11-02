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

### building your game

you can test the game in the browser by clicking "play".

you can build your game by navigating to the "game" menu and clicking "save". if you are using media assets (i.e. image, video, audio assets), you should have the html file within a folder that contains the media folder.

you can also load this html file to edit later.