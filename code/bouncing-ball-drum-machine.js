window.onload = () => {

    /*
    // MAIN CONTROL FLOW
    */

    // Initialize Two.js
    let elem = document.getElementById('draw-shapes');
    let two = new Two({
        width: 500,
        height: 500,
        fullscreen: true,
        type: Two.Types.svg
    }).appendTo(elem);

    // Initialize Howler.js sounds
    let sounds = {
        bassDrum: new Howl({src: ['sounds/bass-drum.wav']}), 
        snareDrum: new Howl({src: ['sounds/snare.wav']}), 
        hiHatLow: new Howl({src: ['sounds/hi-hat-low.wav']}), 
        hiHatHigh: new Howl({src: ['sounds/hi-hat-high.wav']})
    };

    // Store DOM elements we use, so that we can access them without having to pull them from the DOM each time
    let domElements = {
        textInputs: document.getElementById('text-inputs'),
        xVelocityText: document.getElementById('x-velocity-text'),
        yVelocityText: document.getElementById('y-velocity-text'),
        xPositionText: document.getElementById('x-position-text'),
        yPositionText: document.getElementById('y-position-text'),
        borderWidthText: document.getElementById('border-width-text'),
        borderHeightText: document.getElementById('border-height-text'),
        setPropertiesButton: document.getElementById('set-properties-button'),
    }

    // Some variables for managing the state of the program
    let paused = false;
    let audioInitialized = false; // Audio can't start playing until you click the page. This tracks whether that has happened.
    let showNumbers = true;

    // Some constants
    const FILL_ATTRIBUTE_NAME = "fill";
    const STROKE_ATTRIBUTE_NAME = "stroke";

    // Initialize the border
    let border;
    let borderVertexIndices;
    initializeBorder();

    // Initialize the ball
    let ball;
    initializeBall();
    let ballState;
    randomizeBallState();

    // Initialize border-resizing buttons
    let diagonalCornerCircle;
    let horizontalCornerCircle;
    let verticalCornerCircle;
    let freeformButtonDistance = 10; // how far the freeform resize button will be from the bottom right corner (this value is addded to both x and y)
    let freeformCircle;
    initializeBorderResizingCircles();

    // Initialize pause button circle
    let pauseCircle;
    initializePauseButtonCircle();

    // Initialize 'show numbers' circle (for toggling whether the panel showing all the numbers is visible)
    let showNumbersCircle;
    initializeShowNumbersCircle();
    
    two.update(); // this initial 'update' creates SVG '_renderer' properties for our shapes that we can add action listeners to, so it needs to go here

    let audioNotInitializedText; // this shows a message that says "click to unmute" until you click the screen
    initializeTextClickToUnmute();

    // Add event listeners to everything
    addBorderEventListeners(); //  for the rectangle that the ball is contained within
    addBorderResizingButtonsEventListeners();
    addPauseButtonEventListeners();
    addShowNumbersButtonEventListeners(); //  for the button that togggles visibility of the 'numbers' menu
    addStartAudioEventListeners(); // for clicking the screen to start audio playing
    addSetPropertiesButtonEventListeners(); // for the 'set' button

    // The recursive 'update' loop that runs everything 
    function update() {
        if (!paused) {
            // Check for collisions between the ball and the wall. Play sounds and adjust ball position and velocity accordingly.
            let topLeftVertex = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft);
            let bottomRightVertex = getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight);
            if (ballState.xPosition <= topLeftVertex.x) { // collision with left side
                ballState.xPosition = topLeftVertex.x;
                ballState.xVelocity = Math.abs(ballState.xVelocity); // make x velocity positive
                playSound("hi-hat-high");
            } else if (ballState.xPosition >= bottomRightVertex.x) { // collision with right side
                ballState.xPosition = bottomRightVertex.x;
                ballState.xVelocity = Math.abs(ballState.xVelocity) * -1; // make x velocity negative
                playSound("hi-hat-low");
            }
            if (ballState.yPosition <= topLeftVertex.y) { // collision with top
                ballState.yPosition = topLeftVertex.y;
                ballState.yVelocity = Math.abs(ballState.yVelocity);
                playSound("snare-drum");
            } else if (ballState.yPosition >= bottomRightVertex.y) { // collision with bottom
                ballState.yPosition = bottomRightVertex.y;
                ballState.yVelocity = Math.abs(ballState.yVelocity) * -1;
                playSound("bass-drum");
            }
            ball.translation.set(ballState.xPosition, ballState.yPosition);
            updateTextInputs();
            ballState.xPosition += ballState.xVelocity;
            ballState.yPosition += ballState.yVelocity;
        }
        two.update();
        requestAnimationFrame(update);
    }
    
    update();

    /*
    // FUNCTION DEFINITIONS
    */

    // Initialize the border that ball will be contained within. 
    function initializeBorder() {
        let borderWidth = 90;
        let borderHeight = 160;
        let borderPadding = 20;
        let topLeftCornerX = borderPadding;
        let topLeftCornerY = borderPadding;
        let bottomRightCornerX = borderWidth + borderPadding;
        let bottomRightCornerY = borderHeight + borderPadding;
        // Set up an array of points for defining the border, and an object storing indices for accessing each of the vertices by name later
        borderVertexIndices = {
            topLeft: 0,
            topRight: 1,
            bottomRight: 2,
            bottomLeft: 3
        }
        let borderVertices = [];
        borderVertices[borderVertexIndices.topLeft] = new Two.Anchor(topLeftCornerX, topLeftCornerY);
        borderVertices[borderVertexIndices.topRight] = new Two.Anchor(bottomRightCornerX, topLeftCornerY);
        borderVertices[borderVertexIndices.bottomRight] = new Two.Anchor(bottomRightCornerX, bottomRightCornerY);
        borderVertices[borderVertexIndices.bottomLeft] = new Two.Anchor(topLeftCornerX, bottomRightCornerY);
        border = two.makePath(borderVertices, false);
        border.linewidth = 2;
    }

    // Initialize the ball that will bounce around and cause drum sounds to play
    function initializeBall() {
        let ballRadius = 5;
        ball = two.makeCircle(0, 0, ballRadius);
    }
    
    // Construct and return a circle that can be placed on a corner of the border and used as a button for resizing the border using click-and-drag.
    // Parameters: an object { x: ... , y: ... } specifying the position this circle should be initialized at.
    function makeCornerCircle(position) {
        let radius = 4;
        let circle = two.makeCircle(position.x, position.y, radius);
        circle.linewidth = 1;
        circle.fill = 'transparent';
        circle.stroke = 'transparent';
        return circle;
    }

    // Initialize buttons for using click-and-drag to resize the rectangle in various ways.
    function initializeBorderResizingCircles() {
        // Initialize corner buttons for dragging diagonally (scaling x and y evenly) (bottom right corner), horizontal only (top right corner), and veritcal only (bottom left corner).
        diagonalCornerCircle = makeCornerCircle(getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight));
        horizontalCornerCircle = makeCornerCircle(getAbsoluteVertexFromPath(border, borderVertexIndices.topRight));
        verticalCornerCircle = makeCornerCircle(getAbsoluteVertexFromPath(border, borderVertexIndices.bottomLeft));
        // Initialize a button for freeform diagonal drag.
        freeformCircle = makeCornerCircle({
            x: getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight).x + freeformButtonDistance,
            y: getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight).y + freeformButtonDistance
        });
        freeformCircle.stroke = 'black';
        freeformCircle.fill = 'white';
    }

    // Initialize a button to pause / unpause the drum machine
    function initializePauseButtonCircle() {
        pauseCircle = makeCornerCircle({
            x: getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x - 10,
            y: getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).y + 5
        });
        adjustVisualsBasedOnPauseState()
        pauseCircle.stroke = 'black';
    }

    // Initialize a button to show / hide the numbers panel to the right of the drum machine.
    function initializeShowNumbersCircle() {
        showNumbersCircle = makeCornerCircle({
            x: getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x - 10,
            y: getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).y + 20
        });
        adjustVisualsBasedOnShowNumbersState();
        showNumbersCircle.stroke = 'black';
    }

    // Add message to the page saying something like 'click to unmute'
    function initializeTextClickToUnmute() {
        audioNotInitializedText = new Two.Text("Click to unmute", 175, 100);
        audioNotInitializedText.fill = "black";
        audioNotInitializedText.stroke = "white";
        audioNotInitializedText.size = 40;
        two.add(audioNotInitializedText);
    }

    // Set up randomization of the state of the ball
    // Return an object containing information about a new x and y position and velocity for the ball.
    function randomizeBallState() {
        topLeftCorner = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft), 
        bottomRightCorner = getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight)
        // x and y position can be anywhere within the border.
        // x and y velocity randomization parameters were just determined through trial and error
        if (audioInitialized) {
            ball.fill = randomColor();
        }
        ballState = {
            xPosition: Math.floor(Math.random() * (bottomRightCorner.x - topLeftCorner.x)) + topLeftCorner.x,
            yPosition: Math.floor(Math.random() * (bottomRightCorner.y - topLeftCorner.y)) + topLeftCorner.y,
            xVelocity: Math.random() * 4 + 1,
            yVelocity: Math.random() * 4 + 1
        }
        updateTextInputs();
        ball.translation.set(ballState.xPosition, ballState.yPosition);
    }

    // Adjust a number to fall within the specified range (exclusive).
    // TODO: the plan was to use this to easily set minimum / maximum border sizes.
    // But I also kind of like letting the user do whatever they want and break things.
    function restrictNumberToBounds(number, lowerBound, upperBound) {
        if (number < lowerBound) {
            return lowerBound + 1;
        } else if (number > upperBound) {
            return upperBound - 1;
        } else {
            return number;
        }
    }

    // Generate a random hex color that can be used for CSS
    function randomColor () {
        return "#" + Math.floor(Math.random()*16777215).toString(16);
    }

    // Set the cursor that should appear within the specified object
    function setCursor (obj, type) {
        $(obj._renderer.elem).css({cursor: String(type)});
    }

    // Pass in a Two.js path object and a vertex index to get the absolute x, y position of that vertex.
    // Two.js path objects store their vertices, but their coordinates are stored relative to the path's overall position.
    // This method returns absolute vertex positions by accounting for the position of the path. 
    function getAbsoluteVertexFromPath(path, vertexIndex) {
        return {
            x: path.vertices[vertexIndex].x + path.translation.x,
            y: path.vertices[vertexIndex].y + path.translation.y
        }
    }

    // Pass in a Two.js path object, a vertex index, and an object { x: ... , y: ... } to set the absolute position of that vertex. 
    // Two.js path objects store their vertices, but their coordinates are stored relative to the path's overall position.
    // This method sets absolute vertex positions by accounting for the position of the path before setting values. 
    function setPathVertextAbsolute(path, vertexIndex, newPosition) {
        path.vertices[vertexIndex].x = newPosition.x - path.translation.x;
        path.vertices[vertexIndex].y = newPosition.y - path.translation.y;
    }

    // Set attribute value for an object. If 'skip' is specified as true, the change will not be made.
    function setObjectAttributeValueUnlessTrue(shape, attribute, value, skip = false) {
        if (!skip) {
            shape[attribute] = value;
        }
    }

    // Set object's attribute to value 1 if boolean is true, and value 2 if boolean is false
    function selectObjectAttributeValue(shape, attribute, valueIfTrue, valueIfFalse = valueIfTrue, boolean = false){
        if (boolean) {
            shape[attribute] = valueIfTrue;
        } else {
            shape[attribute] = valueIfFalse;
        }
    }

    // Border event listeners
    function addBorderEventListeners(){
        let clickHandler = function(event) {
            event.preventDefault();
            border.fill = randomColor();
            randomizeBallState();
        }
        border._renderer.elem.addEventListener('click', clickHandler);
    }

    // Corner buttons and pause button event listeners
    function addBorderResizingButtonsEventListeners(){
        // initialize some click-and-drag variables
        let draggingFreeform = false
        let draggingDiagonal = false;
        let draggingHorizontal = false;
        let draggingVertical = false;
        // set border / fill colors on enter and exit
        // Diagonal corner
        diagonalCornerCircle._renderer.elem.addEventListener('mouseenter', () => setObjectAttributeValueUnlessTrue(diagonalCornerCircle, STROKE_ATTRIBUTE_NAME, 'black'));
        diagonalCornerCircle._renderer.elem.addEventListener('mouseleave', () => setObjectAttributeValueUnlessTrue(diagonalCornerCircle, STROKE_ATTRIBUTE_NAME, 'transparent', draggingDiagonal));
        // Horizontal corner
        horizontalCornerCircle._renderer.elem.addEventListener('mouseenter', () => setObjectAttributeValueUnlessTrue(horizontalCornerCircle, STROKE_ATTRIBUTE_NAME, 'black'));
        horizontalCornerCircle._renderer.elem.addEventListener('mouseleave', () => setObjectAttributeValueUnlessTrue(horizontalCornerCircle, STROKE_ATTRIBUTE_NAME, 'transparent', draggingHorizontal));
        // Vertical corner
        verticalCornerCircle._renderer.elem.addEventListener('mouseenter', () => setObjectAttributeValueUnlessTrue(verticalCornerCircle, STROKE_ATTRIBUTE_NAME, 'black'));
        verticalCornerCircle._renderer.elem.addEventListener('mouseleave', () => setObjectAttributeValueUnlessTrue(verticalCornerCircle, STROKE_ATTRIBUTE_NAME, 'transparent', draggingVertical));
        // 'Freeform' circle
        freeformCircle._renderer.elem.addEventListener('mouseenter', () => setObjectAttributeValueUnlessTrue(freeformCircle, FILL_ATTRIBUTE_NAME, 'lightgrey'));
        freeformCircle._renderer.elem.addEventListener('mouseleave', () => setObjectAttributeValueUnlessTrue(freeformCircle, FILL_ATTRIBUTE_NAME, 'white'));
        // handle click-and-drag to resize the border
        diagonalCornerCircle._renderer.elem.addEventListener('mousedown', () => {draggingDiagonal = true;});
        horizontalCornerCircle._renderer.elem.addEventListener('mousedown', () => {draggingHorizontal = true;});
        verticalCornerCircle._renderer.elem.addEventListener('mousedown', () => {draggingVertical = true;});
        freeformCircle._renderer.elem.addEventListener('mousedown', () => {draggingFreeform = true;});
        // if the mouse moves while dragging a corner, adjust everything accordingly
        window.addEventListener('mousemove', (event) => {
            event.preventDefault();
            event = adjustEventCoordinates(event);
            if (draggingFreeform) {
                setBorderBottomRightCorner({ x: event.pageX - freeformButtonDistance, y: event.pageY - freeformButtonDistance});
            } else if (draggingHorizontal) {
                setBorderBottomRightCorner({ x: event.pageX, y: verticalCornerCircle.translation.y});
            } else if (draggingVertical) {
                setBorderBottomRightCorner({ x: horizontalCornerCircle.translation.x, y: event.pageY});
            } else if (draggingDiagonal) { // a diagonal drag scales x and y evenly, so it should follow whichever dimension has the smaller magnitude
                let startingPosition = {x: diagonalCornerCircle.translation.x, y: diagonalCornerCircle.translation.y}
                xDragDistance = event.pageX - startingPosition.x
                yDragDistance = event.pageY - startingPosition.y
                let diagonalDragDistance = 0;
                if (xDragDistance * yDragDistance > 0) { // signs of x and y drag distances are the same
                    if (xDragDistance < 0) { // both signs are negative
                        diagonalDragDistance = Math.max(xDragDistance, yDragDistance)
                    } else { // both signs are positive
                        diagonalDragDistance = Math.min(xDragDistance, yDragDistance)
                    }
                }
                setBorderBottomRightCorner({
                    x: getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight).x + diagonalDragDistance, 
                    y: getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight).y + diagonalDragDistance
                });
            }
        });
        // lifting your mouse anywhere means we're no longer dragging any of the corners
        window.addEventListener('mouseup', () => {
            draggingDiagonal = false;
            diagonalCornerCircle.stroke = 'transparent'
            draggingVertical = false;
            verticalCornerCircle.stroke = 'transparent'
            draggingHorizontal = false;
            horizontalCornerCircle.stroke = 'transparent'
            draggingFreeform = false;
        });
    }

    // Event listeners for the 'pause' button
    function addPauseButtonEventListeners() {
        // Handle color change on enter / exit
        pauseCircle._renderer.elem.addEventListener('mouseenter', () => selectObjectAttributeValue(pauseCircle, FILL_ATTRIBUTE_NAME, '#ff6666', '#ff8080', paused)); // lighter than dark red; darker than light red
        pauseCircle._renderer.elem.addEventListener('mouseleave', () => selectObjectAttributeValue(pauseCircle, FILL_ATTRIBUTE_NAME, '#ffb3b3', '#ff0000', paused)); // light red; dark red
        // Handle 'pause' button pause / unpause functionality
        pauseCircle._renderer.elem.addEventListener('click', (event) => {
            event.preventDefault();
            paused = !paused;
            setPropertiesButtonCallback(); // for convenience, the 'pause' button also does the same thing as the 'set' button
            adjustVisualsBasedOnPauseState();
        });
    }

    // Set the visual state of the program based on the current value of the 'paused' variable.
    // Sets the color of the pause button itself, and enables or disables the 'set' button.
    function adjustVisualsBasedOnPauseState() {
        if (paused) {
            setSetPropertiesButtonDisabled(false)
            pauseCircle.fill = '#ffb3b3' // light red
        } else {
            setSetPropertiesButtonDisabled(true)
            pauseCircle.fill = '#ff0000' // dark red
        }
    }

    // Event listeners for the 'show numbers' button, which shows or hides the 'numbers' panel to the right of the rectangle
    function addShowNumbersButtonEventListeners() {
        // Handle color change on enter / exit
        showNumbersCircle._renderer.elem.addEventListener('mouseenter', () => setObjectAttributeValueUnlessTrue(showNumbersCircle, FILL_ATTRIBUTE_NAME, 'lightgrey'));
        showNumbersCircle._renderer.elem.addEventListener('mouseleave', () => selectObjectAttributeValue(showNumbersCircle, FILL_ATTRIBUTE_NAME, 'grey', 'white', showNumbers));
        // Handle 'show numbers' button, to show and hide the panel with numbers
        showNumbersCircle._renderer.elem.addEventListener('click', (event) => {
            event.preventDefault();
            showNumbers = !showNumbers;
            adjustVisualsBasedOnShowNumbersState();
        });
    }

    // Set the visual state of the program based on the current value of the 'showNumbers' variable.
    // Sets the color of the button itself, and either shows or hides the 'numbers' menu.
    function adjustVisualsBasedOnShowNumbersState() {
        if (showNumbers) {
            showNumbersCircle.fill = 'grey';
            domElements.textInputs.style.display = "block";
        } else {
            showNumbersCircle.fill = 'white';
            domElements.textInputs.style.display = "none";
        }
    }

    // Get rid of the "click to unmute" message once the user clicks anywhere in the window.
    function addStartAudioEventListeners() {
        function startAudio(event) {
            if (!audioInitialized){
                audioInitialized = true;
                two.remove(audioNotInitializedText);
                domElements.textInputs.style["z-index"] = 1; // bring the text inputs to the highest layer so we can click them
            }
        }
        window.addEventListener("mousedown", startAudio);
    }

    // The SVG renderer's top left corner isn't necessarily located at (0,0), 
    // so our mouse / touch events may be misaligned until we correct them.
    // event.pageX and event.pageY are read-only, so this method creates and 
    // returns a new event object rather than modifying the one that was passed in.
    // Put any event-specific calls, such as preventDefault(), before this method is called.
    // TODO: This currently only supports mouse events. Add support for touch events.
    function adjustEventCoordinates(event) {
        let svgScale = $(two.renderer.domElement).height() / two.height;
        let svgOrigin = $('#draw-shapes')[0].getBoundingClientRect();
        return {
            pageX: (event.pageX - svgOrigin.left) / svgScale,
            pageY: (event.pageY - svgOrigin.top) / svgScale
        }
    }

    // Resize the border by moving its bottom right corner to the specified position, and moving the other corners to accomodate
    // (so that the border is still a rectangle after changing the position of the bottom right corner).
    // Parameter is an object { x: ... , y: ... } specifying absolute x and y coordinate of the bottom right corner's new position.
    function setBorderBottomRightCorner(newBottomRightCorner) {
        // Move border vertices
        setPathVertextAbsolute(border, borderVertexIndices.bottomRight, newBottomRightCorner);
        oldBottomLeftCorner = getAbsoluteVertexFromPath(border, borderVertexIndices.bottomLeft);
        setPathVertextAbsolute(border, borderVertexIndices.bottomLeft, {x: oldBottomLeftCorner.x, y: newBottomRightCorner.y});
        oldTopRightCorner = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft);
        setPathVertextAbsolute(border, borderVertexIndices.topRight, {x: newBottomRightCorner.x, y: oldTopRightCorner.y});
        // Move corner circles
        diagonalCornerCircle.translation.set(newBottomRightCorner.x, newBottomRightCorner.y)
        horizontalCornerCircle.translation.set(newBottomRightCorner.x, horizontalCornerCircle.translation.y)
        verticalCornerCircle.translation.set(verticalCornerCircle.translation.x, newBottomRightCorner.y)
        freeformCircle.translation.set(diagonalCornerCircle.translation.x + freeformButtonDistance, diagonalCornerCircle.translation.y + freeformButtonDistance)
        // Move text inputs and adjust their contents
        domElements.textInputs.style.left = "" + (getAbsoluteVertexFromPath(border, borderVertexIndices.topRight).x + 20) + "px"
        updateTextInputs();
    }

    // Add event listeners for 'set' button to set the properties of the drum machine
    function addSetPropertiesButtonEventListeners() {
        domElements.setPropertiesButton.addEventListener('click', setPropertiesButtonCallback);
        domElements.setPropertiesButton.addEventListener('mousedown', (event) => {
            domElements.setPropertiesButton.style.backgroundColor = "lightgrey";
        });
        domElements.setPropertiesButton.addEventListener('mouseup', (event) => {
            domElements.setPropertiesButton.style.backgroundColor = "white";
        });
    }

    // Function that gets called when you click the 'set' button (or unpause, for convenience)
    // TODO: add input validation (check for NaN)
    function setPropertiesButtonCallback() {
        let ballXRelativeToTopLeftCorner = parseFloat(domElements.xPositionText.value);
        let ballYRelativeToTopLeftCorner = parseFloat(domElements.yPositionText.value);
        let ballXAbsolute = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x + ballXRelativeToTopLeftCorner;
        let ballYAbsolute = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).y + ballYRelativeToTopLeftCorner;
        ballState.xVelocity = parseFloat(domElements.xVelocityText.value)
        ballState.yVelocity = parseFloat(domElements.yVelocityText.value)
        ballState.xPosition = ballXAbsolute;
        ballState.yPosition = ballYAbsolute;
        ball.translation.set(ballXAbsolute, ballYAbsolute)
        let newBorderBottomRightX = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x + parseFloat(domElements.borderWidthText.value)
        let newBorderBottomRightY = getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).y + parseFloat(domElements.borderHeightText.value)
        setBorderBottomRightCorner({x: newBorderBottomRightX, y: newBorderBottomRightY})
    };

    // Use CSS to enable or disable the 'set' button.
    function setSetPropertiesButtonDisabled(disabled) {
        domElements.setPropertiesButton.disabled = disabled;
        if (disabled) {
            domElements.setPropertiesButton.style.border = "1px solid grey";
        } else {
            domElements.setPropertiesButton.style.border = "1px solid black";
        }
    }

    // Update text inputs to accurately reflect the state of the ball and the border
    function updateTextInputs(){
        domElements.xVelocityText.value = ballState.xVelocity;
        domElements.yVelocityText.value = ballState.yVelocity;
        domElements.xPositionText.value = ballState.xPosition - getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x;
        domElements.yPositionText.value = ballState.yPosition - getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).y;
        domElements.borderWidthText.value = getAbsoluteVertexFromPath(border, borderVertexIndices.topRight).x - getAbsoluteVertexFromPath(border, borderVertexIndices.topLeft).x
        domElements.borderHeightText.value = getAbsoluteVertexFromPath(border, borderVertexIndices.bottomRight).y - getAbsoluteVertexFromPath(border, borderVertexIndices.topRight).y
    }

    function playSound(name) {
        if (!audioInitialized) {
            return;
        }
        switch(name) { // TODO: if we wanted to add live midi output support we could put it here 
            case "hi-hat-high":
                sounds.hiHatHigh.play();
                break;
            case "hi-hat-low":
                sounds.hiHatLow.play();
                break;
            case "bass-drum":
                sounds.bassDrum.play();
                break;
            case "snare-drum":
                sounds.snareDrum.play();
                break;
            default:
                console.log("Sound '" + name + "' not found")
        }
    }
}