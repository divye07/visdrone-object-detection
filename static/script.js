document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file-upload');
    const customFileUploadLabel = document.querySelector('.custom-file-upload');
    const uploadButton = uploadForm.querySelector('button[type="submit"]');
    const preview = document.getElementById('preview');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const loadingMessageSpan = document.getElementById('loading-message');
    const uploadProgressBarContainer = document.getElementById('upload-progress-container');
    const uploadProgressBar = uploadProgressBarContainer.querySelector('.progress-bar');
    const processingProgressBarContainer = document.getElementById('processing-progress-container');
    const processingProgressBar = processingProgressBarContainer.querySelector('.progress-bar');
    const resultSection = document.getElementById('result-section');
    const detectedObjectsCountSpan = document.getElementById('detected-objects-count');
    const processedMediaContainer = document.getElementById('processed-media-container');
    const downloadButton = document.getElementById('download-button');

    // IMPORTANT: Replace this with your deployed Render backend URL
    const BASE_URL = "https://visdrone-object-detection.onrender.com/"; 

    let processingInterval = null;

    function resetUI() {
        uploadForm.reset();
        customFileUploadLabel.style.display = 'inline-block';
        uploadButton.style.display = 'block';
        preview.classList.remove('hidden');
        preview.innerHTML = '<p>Preview will appear here...</p>';
        loadingSpinner.classList.add('hidden');
        uploadProgressBarContainer.classList.add('hidden');
        processingProgressBarContainer.classList.add('hidden');
        uploadProgressBar.style.width = '0%';
        processingProgressBar.style.width = '0%';
        resultSection.classList.add('hidden');
        detectedObjectsCountSpan.textContent = '0';
        processedMediaContainer.innerHTML = '';
        downloadButton.href = '#';
        loadingMessageSpan.textContent = 'Uploading...';
        if (processingInterval) {
            clearInterval(processingInterval);
            processingInterval = null;
        }
    }

    resetUI();

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        preview.innerHTML = '';

        if (!file) {
            preview.innerHTML = '<p>Preview will appear here...</p>';
            resultSection.classList.add('hidden');
            customFileUploadLabel.style.display = 'inline-block';
            uploadButton.style.display = 'block';
            loadingSpinner.classList.add('hidden');
            return;
        }

        const fileType = file.type;
        if (fileType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            preview.appendChild(img);
        } else if (fileType.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            video.preload = 'metadata';
            preview.appendChild(video);
        } else {
            preview.textContent = 'File type not supported.';
        }

        resultSection.classList.add('hidden');
        loadingSpinner.classList.add('hidden');
        customFileUploadLabel.style.display = 'inline-block';
        uploadButton.style.display = 'block';
        preview.classList.remove('hidden');
    });

    uploadForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        resetUI();

        loadingSpinner.classList.remove('hidden');
        uploadProgressBarContainer.classList.remove('hidden');
        uploadProgressBar.style.width = '0%';
        loadingMessageSpan.textContent = `Uploading your "${file.name}"...`;
        
        preview.classList.add('hidden');
        customFileUploadLabel.style.display = 'none';
        uploadButton.style.display = 'none';
        resultSection.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                uploadProgressBar.style.width = percent + '%';
                loadingMessageSpan.textContent = `Uploading "${file.name}"...`;
            }
        };

        xhr.onload = function() {
            console.log('XHR Load: Upload complete. Status:', xhr.status);
            uploadProgressBar.style.width = '100%';
            uploadProgressBarContainer.classList.add('hidden');
            console.log('Upload bar hidden.');

            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                console.log('Response received:', response);
                if (response.error) {
                    alert('Server Error: ' + response.error);
                    resetUI();
                    return;
                }

                processingProgressBarContainer.classList.remove('hidden');
                processingProgressBar.style.width = '0%';
                loadingMessageSpan.textContent = "Processing media...";
                console.log('Processing bar shown, starting simulation.');

                let processingProgress = 0;
                const totalSimulatedTime = 6000;
                const intervalTime = 100;
                const steps = totalSimulatedTime / intervalTime;
                let currentStep = 0;

                processingInterval = setInterval(() => {
                    currentStep++;
                    processingProgress = (currentStep / steps) * 100;
                    processingProgressBar.style.width = processingProgress + '%';

                    if (currentStep <= steps * 0.3) {
                        loadingMessageSpan.textContent = "Making annotations...";
                    } else if (currentStep <= steps * 0.7) {
                        loadingMessageSpan.textContent = "Refining detections...";
                    } else {
                        loadingMessageSpan.textContent = "Getting results ready!";
                    }

                    if (processingProgress >= 100) {
                        clearInterval(processingInterval);
                        processingInterval = null;
                        loadingSpinner.classList.add('hidden');
                        processingProgressBarContainer.classList.add('hidden');
                        displayResult(response.filename, response.detections);
                    }
                }, intervalTime);

            } else {
                alert('Server error: ' + xhr.status + ' ' + xhr.statusText);
                resetUI();
            }
        };

        xhr.onerror = function() {
            alert('Network error or server unavailable. Please check your connection.');
            resetUI();
        };

        xhr.open('POST', `${BASE_URL}/upload`, true);
        xhr.send(formData);
    });

    function displayResult(filename, detections) {
        const mediaUrl = `${BASE_URL}/processed/${filename}`;
        const ext = filename.split('.').pop().toLowerCase();

        processedMediaContainer.innerHTML = '';

        if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) {
            const video = document.createElement('video');
            video.controls = true;
            video.src = mediaUrl;
            video.autoplay = true; 
            video.loop = true; 
            video.muted = true;
            processedMediaContainer.appendChild(video);
        } else if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext)) {
            const img = document.createElement('img');
            img.src = mediaUrl;
            img.alt = "Processed Result";
            processedMediaContainer.appendChild(img);
        } else {
            processedMediaContainer.innerHTML = '<p>Unsupported output file type for display.</p>';
        }

        detectedObjectsCountSpan.textContent = detections;
        downloadButton.href = mediaUrl;

        resultSection.classList.remove('hidden');
        customFileUploadLabel.style.display = 'inline-block';
        uploadButton.style.display = 'block';
        preview.classList.remove('hidden');
    }
}); 
