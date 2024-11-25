// Video adjustment parameters
const VIDEO_BLUR = 30;
const VIDEO_CONTRAST = 1.3;
const VIDEO_SATURATION = 0.9;
const VIDEO_OPACITY = 1;

function initializeCamera(containerId) {
  const PLACEHOLDER_SCALE = 1;
  const container = document.createElement("div");
  container.id = "outer-container";
  container.style.cssText = `width: 523px; height: 380px; background: #000; position: relative; overflow: hidden;`;

  // Add placeholder image
  const placeholderImg = document.createElement("img");
  placeholderImg.src =
    "https://framerusercontent.com/images/OcqLpy4rKgYRSc37ldwyKtD8wgs.png";
  placeholderImg.style.cssText = `
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    transform: scale(${PLACEHOLDER_SCALE});
    transition: opacity 3s ease;
    opacity: 0.95;
  `;
  placeholderImg.id = "camera-placeholder";
  container.appendChild(placeholderImg);

  const canvas = document.createElement("canvas");
  canvas.id = "output-canvas";
  canvas.style.cssText = `
    width: 406px; 
    height: 270px;
    position: absolute;
    left: 58.5px;
    top: 55px;
    border-radius: 133.5px;
    filter: blur(${VIDEO_BLUR}px) contrast(${VIDEO_CONTRAST}) saturate(${VIDEO_SATURATION});
    opacity: 0;
    transform: scaleX(-1);
    z-index: 1;
    transition: opacity 0.4s ease;
  `;

  container.appendChild(canvas);
  document.getElementById(containerId).appendChild(container);

  let ctx;
  let videoElement;
  let selfieSegmentation;
  let tempCanvas;
  let isFirstFrame = true;
  let transitionStarted = false;

  async function setupCamera() {
    const video = document.createElement("video");
    video.style.display = "none";
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 406,
        height: 270,
      },
    });
    video.srcObject = stream;
    await video.play();

    return video;
  }

  async function initSegmentation() {
    try {
      videoElement = await setupCamera();

      const canvas = document.getElementById("output-canvas");
      canvas.width = 406;
      canvas.height = 270;
      ctx = canvas.getContext("2d", { willReadFrequently: true });

      tempCanvas = document.createElement("canvas");
      tempCanvas.width = 406;
      tempCanvas.height = 270;

      selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        },
      });

      selfieSegmentation.setOptions({
        modelSelection: 1,
        selfieMode: false,
      });

      selfieSegmentation.onResults(onResults);

      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await selfieSegmentation.send({ image: videoElement });
        },
        width: 406,
        height: 270,
      });
      camera.start();
    } catch (err) {
      console.error("Error initializing segmentation:", err);
    }
  }

  function onResults(results) {
    if (!results || !results.segmentationMask || !results.image) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    ctx.save();

    tempCtx.drawImage(
      results.segmentationMask,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

    ctx.drawImage(results.image, 0, 0, ctx.canvas.width, ctx.canvas.height);

    const imageData = ctx.getImageData(
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height
    );
    const pixels = imageData.data;

    const maskData = tempCtx.getImageData(
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

    for (let i = 0; i < pixels.length; i += 4) {
      const maskValue = maskData.data[i];
      pixels[i + 3] = maskValue > 128 ? maskValue : 0;
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();

    // Start transition after first successful frame
    if (isFirstFrame && !transitionStarted) {
      transitionStarted = true;
      const canvas = document.getElementById("output-canvas");
      const placeholder = document.getElementById("camera-placeholder");

      // Ensure canvas is visible but fully transparent
      canvas.style.opacity = "0";
      canvas.style.display = "block";

      // Start crossfade
      requestAnimationFrame(() => {
        // Fade in canvas
        canvas.style.opacity = VIDEO_OPACITY;
        // Fade out placeholder
        placeholder.style.opacity = "0";

        // Remove placeholder after transition
        setTimeout(() => {
          placeholder.remove();
        }, 300); // Match transition duration
      });

      isFirstFrame = false;
    }
  }

  // Initialize everything
  initSegmentation();
}

// Export the function
window.initializeCamera = initializeCamera;
