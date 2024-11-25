<!-- Adjustable parameters -->
<script>
    // Video adjustment parameters
    let VIDEO_BLUR = 30;        // Blur amount in pixels
    let VIDEO_CONTRAST = 1.3;     // 1.0 is normal, >1 increases contrast, <1 decreases contrast
    let VIDEO_SATURATION = 0.9;   // 1.0 is normal, >1 increases saturation, <1 decreases saturation
    let VIDEO_OPACITY = 0.9;      // 1.0 is fully opaque, 0 is transparent
</script>

<div id="outer-container" style="width: 523px; height: 380px; background: #000; position: relative; overflow: hidden;">
    <canvas id="output-canvas" style="
        width: 406px; 
        height: 270px;
        position: absolute;
        left: 58.5px;
        top: 55px;
        border-radius: 133.5px;
        filter: blur(${VIDEO_BLUR}px) contrast(${VIDEO_CONTRAST}) saturate(${VIDEO_SATURATION});
        opacity: ${VIDEO_OPACITY};
        transform: scaleX(-1);
    "></canvas>
</div>

<script src="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils"></script>

<script>
    let ctx;
    let videoElement;
    let selfieSegmentation;
    let tempCanvas;

    async function setupCamera() {
        const video = document.createElement('video');
        video.style.display = 'none';
        document.body.appendChild(video);
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: 406, 
                height: 270
            }
        });
        video.srcObject = stream;
        await video.play();
        
        return video;
    }

    async function initSegmentation() {
        try {
            videoElement = await setupCamera();
            
            const canvas = document.getElementById('output-canvas');
            canvas.width = 406;
            canvas.height = 270;
            ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Update canvas filter based on parameters
            canvas.style.filter = `blur(${VIDEO_BLUR}px) contrast(${VIDEO_CONTRAST}) saturate(${VIDEO_SATURATION})`;
            canvas.style.opacity = VIDEO_OPACITY;

            // Create temporary canvas for processing
            tempCanvas = document.createElement('canvas');
            tempCanvas.width = 406;
            tempCanvas.height = 270;

            selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                }
            });

            selfieSegmentation.setOptions({
                modelSelection: 1,
                selfieMode: false
            });

            selfieSegmentation.onResults(onResults);

            const camera = new Camera(videoElement, {
                onFrame: async () => {
                    await selfieSegmentation.send({image: videoElement});
                },
                width: 406,
                height: 270
            });
            camera.start();

        } catch (err) {
            console.error('Error initializing segmentation:', err);
        }
    }

    function onResults(results) {
        if (!results || !results.segmentationMask || !results.image) return;

        // Clear both canvases completely
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

        ctx.save();

        // Draw segmentation mask to temp canvas
        tempCtx.drawImage(results.segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the original image
        ctx.drawImage(results.image, 0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const pixels = imageData.data;
        
        // Get the mask data
        const maskData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Apply the mask with threshold to prevent ghosting
        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = maskData.data[i];
            pixels[i + 3] = maskValue > 128 ? maskValue : 0;
        }
        
        // Clear canvas before drawing new frame
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Draw the masked image
        ctx.putImageData(imageData, 0, 0);
        
        ctx.restore();
    }

    // Initialize everything
    initSegmentation();
</script>