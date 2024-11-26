// 在文件开头添加生成星星的函数
function generateStars(count) {
    let result = '';
    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * window.innerWidth);
        const y = Math.floor(Math.random() * window.innerHeight);
        const opacity = Math.random();
        result += `${x}px ${y}px rgba(255, 255, 255, ${opacity}),`;
    }
    return result.slice(0, -1); // 移除最后一个逗号
}

class ImageCompressor {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.previewContainer = document.getElementById('previewContainer');
        this.compressionSlider = document.getElementById('compressionSlider');
        this.sliderValue = document.getElementById('sliderValue');
        this.outputFormat = document.getElementById('outputFormat');
        this.targetSize = document.getElementById('targetSize');
        this.compressionType = document.getElementsByName('compressionType');
        this.outputFormatRadios = document.getElementsByName('outputFormat');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 拖拽上传
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });

        // 文件选择上传
        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
        });

        // 添加滑动条事件监听
        this.compressionSlider.addEventListener('input', () => {
            const value = this.compressionSlider.value;
            this.sliderValue.textContent = `${value}%`;
        });
    }

    handleFiles(files) {
        // 检查文件数量
        if (files.length > 10) {
            alert('最多只能同时上传10张图片');
            return;
        }

        // 过滤并处理图片文件
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert(`文件 ${file.name} 不是图片格式`);
                return;
            }

            if (file.size > 20 * 1024 * 1024) {
                alert(`文件 ${file.name} 超过20MB限制`);
                return;
            }

            this.processImage(file);
        });
    }

    async processImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                this.createPreviewCard(file, img);
            };
        };
        reader.readAsDataURL(file);
    }

    createPreviewCard(file, img) {
        const card = document.createElement('div');
        card.className = 'preview-card';
        card.innerHTML = `
            <div class="image-preview">
                <img src="${img.src}" alt="${file.name}">
            </div>
            <div class="image-info">
                <p>文件名：${file.name}</p>
                <p>原始大小：${this.formatFileSize(file.size)}</p>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
                <button class="compress-btn">开始压缩</button>
            </div>
        `;

        const compressBtn = card.querySelector('.compress-btn');
        compressBtn.addEventListener('click', () => this.compressImage(file, card));

        this.previewContainer.appendChild(card);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async compressImage(file, card) {
        const compressBtn = card.querySelector('.compress-btn');
        const progressBar = card.querySelector('.progress');
        const imageInfo = card.querySelector('.image-info');
        
        compressBtn.disabled = true;
        compressBtn.textContent = '压缩中...';

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = await this.loadImage(file);

            // 获取压缩配置
            const settings = this.getCompressionSettings();
            
            // 计算新的尺寸
            let { width, height } = img;
            if (width > settings.maxWidth || height > settings.maxHeight) {
                if (width > height) {
                    height = Math.round((height * settings.maxWidth) / width);
                    width = settings.maxWidth;
                } else {
                    width = Math.round((width * settings.maxHeight) / height);
                    height = settings.maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // 获取选中的输出格式
            const selectedFormat = document.querySelector('input[name="outputFormat"]:checked').value;
            let mimeType = file.type; // 默认使用原始格式
            let outputExtension = file.name.split('.').pop(); // 默认使用原始扩展名

            if (selectedFormat === 'jpg') {
                mimeType = 'image/jpeg';
                outputExtension = 'jpg';
            }

            // 转换为blob
            let blob = await new Promise(resolve => {
                canvas.toBlob(resolve, mimeType, settings.quality);
            });

            // 如果压缩后的大小仍然超过目标大小，进行迭代压缩
            let quality = settings.quality;
            while (blob.size > settings.targetSize && quality > 0.1) {
                quality -= 0.1;
                blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, mimeType, quality);
                });
            }

            // 更新进度条和信息
            progressBar.style.width = '100%';
            
            // 创建新的下载按钮
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'compress-btn';
            downloadBtn.textContent = '下载压缩图片';
            downloadBtn.addEventListener('click', () => {
                // 传递新的扩展名到下载方法
                this.downloadImage(URL.createObjectURL(blob), file.name, outputExtension);
            });

            // 更新压缩信息
            imageInfo.innerHTML = `
                <p>文件名：${file.name}</p>
                <p>原始大小：${this.formatFileSize(file.size)}</p>
                <p>压缩后大小：${this.formatFileSize(blob.size)}</p>
                <p>体积减小：${Math.round((1 - blob.size / file.size) * 100)}%</p>
                <p>输出格式：${mimeType.split('/')[1].toUpperCase()}</p>
                <p>图片尺寸：${width} x ${height}</p>
                <div class="progress-bar">
                    <div class="progress" style="width: 100%"></div>
                </div>
            `;
            imageInfo.appendChild(downloadBtn);

        } catch (error) {
            console.error('压缩失败:', error);
            imageInfo.innerHTML = `
                <p>文件名：${file.name}</p>
                <p>原始大小：${this.formatFileSize(file.size)}</p>
                <p class="error-message">压缩失败：${error.message}</p>
                <button class="compress-btn">重试</button>
            `;
            const retryBtn = imageInfo.querySelector('.compress-btn');
            retryBtn.addEventListener('click', () => this.compressImage(file, card));
        }
    }

    getCompressionSettings() {
        // 获取选中的压缩类型
        const selectedType = document.querySelector('input[name="compressionType"]:checked').value;
        
        // 获取目标大小（KB转为字节）
        const targetSizeBytes = parseInt(document.getElementById('targetSize').value) * 1024;

        // 根据压缩类型返回不同的压缩参数
        switch(selectedType) {
            case 'size':
                return {
                    quality: 0.7,
                    maxWidth: 2048,
                    maxHeight: 2048,
                    targetSize: targetSizeBytes
                };
            case 'quality':
                return {
                    quality: 0.9,
                    maxWidth: 4096,
                    maxHeight: 4096,
                    targetSize: targetSizeBytes
                };
            default: // normal
                return {
                    quality: 0.8,
                    maxWidth: 3072,
                    maxHeight: 3072,
                    targetSize: targetSizeBytes
                };
        }
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    downloadImage(url, filename, outputExtension) {
        const originalNameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        const newFilename = `compressed_${originalNameWithoutExt}.${outputExtension}`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = newFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// 在 DOMContentLoaded 事件中初始化星星
document.addEventListener('DOMContentLoaded', () => {
    // 生成星星
    document.getElementById('stars').style.boxShadow = generateStars(700);
    document.getElementById('stars2').style.boxShadow = generateStars(200);
    document.getElementById('stars3').style.boxShadow = generateStars(100);

    // 初始化图片压缩器
    new ImageCompressor();
}); 