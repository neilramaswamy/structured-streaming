class JoinDiagram extends HTMLElement {
    constructor() {
      super();
  
      // Matches of the form "(0, 20, Watermark is 30, green), (40, 60, Watermark is 30, red)"
      this.ZONE_REGEX = /\((\d+), (\d+), (.*?), (.*?)\),?/g;
  
      // Matches of the form "(0, 100)" or "(5,10)"
      this.RANGE_REGEX = /\((\d+),\s*(\d+)\)$/;
  
      // matches of the form "(foo, 30), (bar, 4)"
      this.EVENT_REGEX = /\(([a-zA-Z]+),\s*(\d+)\),?/g;
  
      // The CSS var set on the individual timelines that converts a single
      // percent of length into a number of pixels.
      this.PERCENT_TO_PIXELS = "--percent-to-pixels";
  
      this.LEFT_LABEL_DEFAULT = "L";
      this.RIGHT_LABEL_DEFAULT = "R";
  
      // In pixels
      this.TIMELINE_HEIGHT = 4;
      this.DOT_SIDE_HEIGHT = 12;
      this.ZONE_BORDER_WIDTH = 2;
    }
  
    connectedCallback() {
      const rangeStartString = this.getAttribute("range-start");
      const rangeEndString = this.getAttribute("range-end");
  
      const leftEventString = this.getAttribute("left-events");
      const rightEventString = this.getAttribute("right-events");
      const leftZoneString = this.getAttribute("left-zones");
      const rightZoneString = this.getAttribute("right-zones");
      const oneSided = this.getAttribute("one-sided");
  
      const rangeStart =
        rangeStartString === null ? 0 : parseInt(rangeStartString);
      const rangeEnd = rangeEndString === null ? 100 : parseInt(rangeEndString);
  
      const shouldRenderRightSide = oneSided === null;
  
      const leftLabel =
        this.getAttribute("left-label") ?? this.LEFT_LABEL_DEFAULT;
      const rightLabel =
        this.getAttribute("right-label") ?? this.RIGHT_LABEL_DEFAULT;
  
      let leftEvents = [];
      if (leftEventString !== null) {
        leftEvents = [...leftEventString.matchAll(this.EVENT_REGEX)].map(
          (matchArray) => [matchArray[1], parseInt(matchArray[2])]
        );
      }
  
      let rightEvents = [];
      if (rightEventString !== null) {
        rightEvents = [...rightEventString.matchAll(this.EVENT_REGEX)].map(
          (matchArray) => [matchArray[1], parseInt(matchArray[2])]
        );
      }
  
      let leftZones = [];
      if (leftZoneString !== null) {
        leftZones = [...leftZoneString.matchAll(this.ZONE_REGEX)].map(
          (matchArray) => [
            parseInt(matchArray[1]),
            parseInt(matchArray[2]),
            matchArray[3], // Label
            // matchArray[4], // Color
            "var(--md-accent-fg-color)",
          ]
        );
      }
  
      let rightZones = [];
      if (rightZoneString !== null) {
        rightZones = [...rightZoneString.matchAll(this.ZONE_REGEX)].map(
          (matchArray) => [
            parseInt(matchArray[1]),
            parseInt(matchArray[2]),
            matchArray[3], // Label
            // matchArray[4], // Color
            "var(--md-accent-fg-color)",
          ]
        );
      }
  
      this.renderDiagram(
        rangeStart,
        rangeEnd,
  
        leftLabel,
        leftEvents,
        leftZones,
  
        shouldRenderRightSide,
        rightLabel,
        rightEvents,
        rightZones
      );
    }
  
    /**
     *
     * @param {number} rangeStart
     * @param {number} rangeEnd
     *
     * @param {[string, number][]} leftEvents
     * @param {[number, number, string, string][]} leftZones
     *
     * @param { boolean } shouldRenderRightSide
     * @param {[string, number][]} rightEvents
     * @param {[number, number, string, string][]} rightZones
     */
    renderDiagram(
      rangeStart,
      rangeEnd,
  
      leftLabel,
      leftEvents,
      leftZones,
      shouldRenderRightSide,
      rightLabel,
      rightEvents,
      rightZones
    ) {
      const shadow = this.attachShadow({ mode: "open" });
  
      /**
       * Creates a rectangular region with a label over a region.
       *
       * @param {HTMLElement} sideSpecificTimeline
       * @param {boolean} isLeft whether the timeline is the left (top) or right (bottom)
       * @param {number} startTime the beginning of the zone
       * @param {number} endTime  the end of the zone
       * @param {string} label the label of the zone
       * @param {string} color the color of the zone
       */
      const renderZone = (
        sideSpecificTimeline,
        isLeft,
        startTime,
        endTime,
        label,
        color
      ) => {
        const zone = document.createElement("div");
        zone.style.position = "absolute";
        zone.style.border = `${this.ZONE_BORDER_WIDTH}px solid ${color}`;
        zone.style.height = "20px";
  
        zone.style.backgroundImage = `
          linear-gradient(
            135deg,
            transparent 25%, 
            ${color} 25%, ${color} 50%,
            transparent 50%, transparent 75%,
            ${color} 75%, ${color} 100%)`;
        zone.style.backgroundSize = "6px 6px";
  
        if (startTime === rangeStart) {
          zone.style.borderLeft = "none";
        }
        if (endTime === rangeEnd) {
          zone.style.borderRight = "none";
        }
  
        // Label stuff
        const labelNode = document.createElement("span");
        labelNode.innerText = label;
  
        labelNode.style.position = "absolute";
        labelNode.style.right = `-${this.ZONE_BORDER_WIDTH}px`;
        labelNode.style.top = "0";
        labelNode.style.fontSize = "0.6rem";
        labelNode.style.whiteSpace = "nowrap";
  
        if (isLeft) {
          labelNode.style.transform = `translateY(calc(100% + ${
            this.TIMELINE_HEIGHT / 2
          }px))`;
        } else {
          labelNode.style.transform = `translateY(calc(-100% - ${
            this.TIMELINE_HEIGHT / 2
          }px))`;
        }
  
        zone.appendChild(labelNode);
  
        const zonePercentOfWidth =
          ((endTime - startTime) / (rangeEnd - rangeStart)) * 100;
  
        const percentFromLeft =
          ((startTime - rangeStart) / (rangeEnd - rangeStart)) * 100;
  
        zone.style.left = `calc(${percentFromLeft} * var(${this.PERCENT_TO_PIXELS}))`;
        zone.style.width = `calc(${zonePercentOfWidth} * var(${this.PERCENT_TO_PIXELS}))`;
        zone.style.transform = `translate(-${this.ZONE_BORDER_WIDTH}px, calc(-50% + ${this.ZONE_BORDER_WIDTH}px))`;
  
        sideSpecificTimeline.appendChild(zone);
      };
  
      /**
       * Renders the events for a particular side onto the given timeline.
       *
       * @param {HTMLElement} sideSpecificTimeline
       * @param {[string, number][]} events
       * @param {boolean} isLeft, if false, then we're rendering the right timeline.
       */
      const renderTimeline = (sideSpecificTimeline, events, isLeft) => {
        events.forEach((event) => {
          const name = event[0];
          const time = event[1];
  
          const percentFromLeft =
            ((time - rangeStart) / (rangeEnd - rangeStart)) * 100;
  
          // Here's what the UI should look like, where the bracket is a dot:
          //
          // -------------[-]-------------
          //           (foo, 30)
          //
          // We need to make sure that the dot is positioned at percentFromLeft
          // away from the left.
          //
          // We create a flex-column div aligned horizontally, and then do fun
          // math to align the dot at the correct spot. This is everything React
          // wishes it were.
  
          const eventContainer = document.createElement("div");
          eventContainer.style.position = "absolute";
          eventContainer.style.display = "flex";
          eventContainer.style.flexDirection = "column";
          eventContainer.style.alignItems = "center";
  
          const eventDot = document.createElement("div");
          eventDot.style.width =
            eventDot.style.height = `${this.DOT_SIDE_HEIGHT}px`;
          eventDot.style.borderRadius = "50%";
          eventDot.style.backgroundColor = "var(--md-code-hl-number-color)";
  
          const eventText = document.createElement("span");
          eventText.style.fontFamily = "var(--md-code-font-family)";
          eventText.style.fontSize = "0.75rem";
          eventText.style.whiteSpace = "nowrap";
          eventText.innerText = `(${name}, ${time})`;
  
          // When on the left (the top), render the text above the dot.
          if (isLeft) {
            eventContainer.appendChild(eventText);
            eventContainer.appendChild(eventDot);
  
            eventContainer.style.transform = `translate(-50%, calc(-100% + ${
              this.DOT_SIDE_HEIGHT / 2 + this.TIMELINE_HEIGHT / 2
            }px))`;
  
            eventText.style.marginBottom = "8px";
          } else {
            eventContainer.appendChild(eventDot);
            eventContainer.appendChild(eventText);
  
            eventContainer.style.transform = `translate(-50%, -${
              this.DOT_SIDE_HEIGHT / 2 - this.TIMELINE_HEIGHT / 2
            }px)`;
  
            eventText.style.marginTop = "6px";
          }
  
          eventContainer.style.left = `calc(${percentFromLeft} * var(${this.PERCENT_TO_PIXELS}))`;
  
          sideSpecificTimeline.appendChild(eventContainer);
        });
      };
  
      /**
       * Create a stream side. Contains a label, and then will have a timeline.
       *
       * @param {string} side
       * @returns {HTMLElement}
       */
      const createStreamSide = (side) => {
        const streamSide = document.createElement("div");
        streamSide.style.display = "flex";
        streamSide.style.alignItems = "center";
  
        const name = document.createElement("span");
        name.innerText = side;
        name.style.marginRight = "16px";
        name.style.fontFamily = "var(--md-code-font-family)";
        name.style.whiteSpace = "nowrap";
  
        streamSide.appendChild(name);
  
        return streamSide;
      };
  
      /**
       * Create a relatively positioned timeline. Does not add it to the DOM.
       *
       * @returns {HTMLElement}
       */
      const createTimelineContainer = () => {
        const timeline = document.createElement("div");
        timeline.style.position = "relative";
        timeline.style.width = "100%";
        timeline.style.height = `${this.TIMELINE_HEIGHT}px`;
  
        timeline.style.backgroundColor = "var(--md-default-fg-color)";
        timeline.style.borderRadius = "4px";
  
        return timeline;
      };
  
      // Create a container with two timelines
      const container = document.createElement("div");
      container.style.width = "100%";
      container.style.maxWidth = "600px";
      container.style.display = "flex";
  
      // incantation works because parent has max-width
      container.style.margin = "3em auto";
  
      container.style.flexDirection = "column";
      container.style.justifyContent = "space-between";
  
      // Create stream sides
      const leftStreamSide = createStreamSide(leftLabel);
      const leftTimeline = createTimelineContainer();
      renderTimeline(leftTimeline, leftEvents, true);
      leftZones.forEach(([start, end, label, color]) =>
        renderZone(leftTimeline, true, start, end, label, color)
      );
      leftStreamSide.appendChild(leftTimeline);
      container.appendChild(leftStreamSide);
  
      /** @type {HTMLElement | null} */
      let rightTimeline = null;
      if (shouldRenderRightSide) {
        const rightStreamSide = createStreamSide(rightLabel);
        rightTimeline = createTimelineContainer();
        renderTimeline(rightTimeline, rightEvents, false);
        rightZones.forEach(([start, end, label, color]) => {
          renderZone(rightTimeline, false, start, end, label, color);
        });
        rightStreamSide.appendChild(rightTimeline);
  
        // If we're rendering the right-side, we need a spacer.
        const spacer = document.createElement("div");
        spacer.style.height = "4em";
  
        container.appendChild(spacer);
        container.appendChild(rightStreamSide);
      }
  
      // Add the main container to the shadow root
      shadow.appendChild(container);
  
      // Setting the base percentage-to-pixel unit
      const setPercentageToPixelUnit = () => {
        const timelineWidth = leftTimeline.getBoundingClientRect().width;
        const conversion = `${timelineWidth / 100}px`;
  
        const timelines = [leftTimeline];
        if (rightTimeline !== null) {
          timelines.push(rightTimeline);
        }
  
        timelines.forEach((t) =>
          t.style.setProperty(this.PERCENT_TO_PIXELS, conversion)
        );
      };
  
      setPercentageToPixelUnit();
      window.addEventListener("resize", setPercentageToPixelUnit);
    }
  
    disconnectedCallback() {
      console.log("Custom element removed from page.");
    }
  
    adoptedCallback() {
      console.log("Custom element moved to new page.");
    }
  
    attributeChangedCallback(name, oldValue, newValue) {
      console.log(`Attribute ${name} has changed.`);
    }
  }
  
  customElements.define("join-diagram", JoinDiagram);
  