document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const reelsForm = document.getElementById('reels-form');
    const reelsUrlInput = document.getElementById('reels-url');
    const btnSubmit = document.getElementById('btn-submit');
    const resultContainer = document.getElementById('result-container');
    const videoTitle = document.getElementById('video-title');
    const videoDuration = document.getElementById('video-duration');
    const downloadButtons = document.querySelectorAll('.btn-download');
    const toastContainer = document.getElementById('toast-container');

    // 1. Mobile Menu Toggle
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu and smooth scroll when clicking a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                
                const targetId = link.getAttribute('href');
                if (targetId.startsWith('#')) {
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        e.preventDefault();
                        const headerEl = document.querySelector('.header');
                        const headerHeight = headerEl ? headerEl.offsetHeight : 80;
                        const targetPos = targetEl.offsetTop - headerHeight + 5;
                        window.scrollTo({
                            top: targetPos,
                            behavior: 'smooth'
                        });
                        
                        navLinks.forEach(l => l.classList.remove('active'));
                        link.classList.add('active');
                    }
                }
            });
        });
    }

    // Helper: Show Toast Notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow/animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 3000);
    }

    // Helper: Extract a mock ID/slug from Facebook Reels URLs
    function extractReelSlug(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
            
            // Look for reels or reel path
            const reelIdx = pathParts.findIndex(p => p === 'reels' || p === 'reel');
            if (reelIdx !== -1 && pathParts[reelIdx + 1]) {
                return pathParts[reelIdx + 1].substring(0, 15);
            }
            
            // Look for any parameter
            const fbid = urlObj.searchParams.get('v') || urlObj.searchParams.get('fbid');
            if (fbid) return fbid.substring(0, 15);
            
            // Return fallback random code
            return Math.floor(1000000000 + Math.random() * 9000000000).toString();
        } catch (e) {
            // Fallback for non-standard links
            return Math.floor(1000000000 + Math.random() * 9000000000).toString();
        }
    }

    // Helper: Trigger direct download using blob or fallback to tab redirection
    async function downloadFile(url, filename, quality) {
        showToast(`Đang chuẩn bị tải xuống ${quality}...`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Mạng không phản hồi tốt');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
            showToast(`Tải ${quality} thành công!`);
        } catch (error) {
            console.warn('Lỗi tải file trực tiếp (CORS hoặc Mạng), chuyển hướng mở tab mới:', error);
            // Fallback: Open in a new tab
            window.open(url, '_blank', 'noopener,noreferrer');
            showToast('Không tải trực tiếp được. Đang mở tab mới, bạn vui lòng chuột phải chọn "Lưu..." để tải về.');
        }
    }

    // 2. Form Submission & Video Parsing (Real API Request)
    if (reelsForm) {
        reelsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = reelsUrlInput.value.trim();

            if (!url) {
                showToast('Vui lòng nhập đường dẫn Reels Facebook!');
                return;
            }

            // Simple check to ensure it looks like a URL/domain
            if (!url.startsWith('http://') && !url.startsWith('https://') && !url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
                showToast('Đường dẫn không hợp lệ. Vui lòng nhập link Facebook.');
                return;
            }

            // Loading state
            btnSubmit.disabled = true;
            const originalBtnHtml = btnSubmit.innerHTML;
            btnSubmit.innerHTML = `
                <svg class="spinner" width="16" height="16" viewBox="0 0 50 50" style="animation: spin 1s linear infinite; margin-right: 8px;">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="80, 200" stroke-dashoffset="0"></circle>
                </svg>
                <span>Đang phân tích...</span>
            `;

            // Style spin animation dynamically if not present
            if (!document.getElementById('spin-keyframes')) {
                const styleSheet = document.createElement("style");
                styleSheet.id = 'spin-keyframes';
                styleSheet.innerText = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
                document.head.appendChild(styleSheet);
            }

            // Collapse previous results if open
            resultContainer.classList.remove('show');

            // Send actual request to the Cloudflare Worker API
            const apiUrl = `https://steep-pine-5334.minhnhatdeptroai.workers.dev/getReelsVideo?url=${encodeURIComponent(url)}`;
            
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Lỗi phản hồi mạng');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.video_delivery) {
                        // 1. Populate metadata (Title, ID, Execution Time)
                        videoTitle.textContent = data.title || `Reels_Facebook_Video_${data.post_id || 'Download'}.mp4`;
                        
                        let metaInfo = '';
                        if (data.post_id) {
                            metaInfo += `ID: ${data.post_id}`;
                        }
                        if (data.execution_time) {
                            if (metaInfo) metaInfo += ' • ';
                            metaInfo += `Thời gian xử lý: ${data.execution_time}`;
                        }
                        videoDuration.textContent = metaInfo || 'Thời lượng: Gốc';

                        // 2. Set thumbnail cover and play actions
                        const videoThumbnailPreview = document.getElementById('video-thumbnail-preview');
                        if (videoThumbnailPreview) {
                            if (data.thumbnail_url) {
                                videoThumbnailPreview.style.backgroundImage = `url('${data.thumbnail_url}')`;
                                videoThumbnailPreview.style.backgroundSize = 'cover';
                                videoThumbnailPreview.style.backgroundPosition = 'center';
                            }
                            
                            // Map play click to open the video URL
                            const previewUrl = data.video_delivery.hd_url || data.video_delivery.sd_url;
                            if (previewUrl) {
                                videoThumbnailPreview.style.cursor = 'pointer';
                                videoThumbnailPreview.onclick = () => {
                                    window.open(previewUrl, '_blank', 'noopener,noreferrer');
                                };
                            } else {
                                videoThumbnailPreview.onclick = null;
                                videoThumbnailPreview.style.cursor = 'default';
                            }
                        }

                        // 3. Render download options (HD, SD, Audio - Excluding dash_video_urls)
                        const downloadOptionsList = document.getElementById('download-options-list');
                        if (downloadOptionsList) {
                            downloadOptionsList.innerHTML = '';
                            let optionsHtml = '';

                            // HD Quality Option
                            if (data.video_delivery.hd_url) {
                                optionsHtml += `
                                    <div class="download-option-item premium">
                                        <div class="option-info">
                                            <span class="option-quality">Full HD / HD (720p)</span>
                                            <span class="option-size">Tải xuống chất lượng tốt nhất</span>
                                        </div>
                                        <a href="${data.video_delivery.hd_url}" class="btn-download primary" data-quality="Full HD / HD" target="_blank" rel="noopener noreferrer">
                                            Tải về
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                        </a>
                                    </div>
                                `;
                            }

                            // SD Quality Option
                            if (data.video_delivery.sd_url) {
                                optionsHtml += `
                                    <div class="download-option-item">
                                        <div class="option-info">
                                            <span class="option-quality">Standard quality (SD)</span>
                                            <span class="option-size">Tải xuống tiết kiệm dung lượng</span>
                                        </div>
                                        <a href="${data.video_delivery.sd_url}" class="btn-download" data-quality="SD" target="_blank" rel="noopener noreferrer">
                                            Tải về
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                        </a>
                                    </div>
                                `;
                            }

                            // Audio Quality Option
                            if (data.video_delivery.dash_audio_urls && data.video_delivery.dash_audio_urls.length > 0) {
                                optionsHtml += `
                                    <div class="download-option-item">
                                        <div class="option-info">
                                            <span class="option-quality">Chỉ có âm thanh (M4A)</span>
                                            <span class="option-size">Tải nhạc nền của video</span>
                                        </div>
                                        <a href="${data.video_delivery.dash_audio_urls[0]}" class="btn-download" data-quality="Audio M4A" target="_blank" rel="noopener noreferrer">
                                            Tải về
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                        </a>
                                    </div>
                                `;
                            }

                            downloadOptionsList.innerHTML = optionsHtml;

                            // Bind custom direct download or fallback to new tab
                            const dynamicButtons = downloadOptionsList.querySelectorAll('.btn-download');
                            dynamicButtons.forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    const href = btn.getAttribute('href');
                                    const quality = btn.getAttribute('data-quality') || 'Video';
                                    const fileExtension = quality.toLowerCase().includes('audio') ? 'm4a' : 'mp4';
                                    const filename = `GetReels_${data.post_id || 'video'}_${quality.replace(/[\s/]+/g, '_')}.${fileExtension}`;
                                    
                                    downloadFile(href, filename, quality);
                                });
                            });
                        }

                        // Open results
                        resultContainer.classList.add('show');
                        showToast('Đã nhận diện và phân tích video thành công!');
                    } else {
                        showToast(data.message || 'Không tìm thấy video Reels hợp lệ. Vui lòng thử lại!');
                    }
                })
                .catch(error => {
                    console.error('API Error:', error);
                    showToast('Lỗi máy chủ hoặc liên kết không được hỗ trợ. Vui lòng kiểm tra lại!');
                })
                .finally(() => {
                    // Reset button loading state
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = originalBtnHtml;
                });
        });
    }

    // 4. Dark Mode Toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Check for stored preference or system default
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark');
    }
    
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            showToast(isDark ? 'Đã kích hoạt chế độ tối!' : 'Đã kích hoạt chế độ sáng!');
        });
    }

    // 5. FAQ Accordion Toggle
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close all FAQ items
            document.querySelectorAll('.faq-item').forEach(i => {
                i.classList.remove('active');
                i.querySelector('.faq-answer').style.maxHeight = null;
            });
            
            // Open clicked item if it wasn't active
            if (!isActive) {
                item.classList.add('active');
                const answer = item.querySelector('.faq-answer');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    // 6. Scroll Spy for active nav menu highlighting
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinksList = document.querySelectorAll('.nav-link');
    
    function updateScrollSpy() {
        let scrollPos = window.scrollY || document.documentElement.scrollTop;
        const offset = 120; // Highlight offset when section is close to header
        
        let activeSectionId = 'hero';
        
        // Manually check if we are at top
        const heroEl = document.getElementById('hero');
        if (heroEl && scrollPos < heroEl.offsetHeight - offset) {
            activeSectionId = 'hero';
        } else {
            document.querySelectorAll('section[id]').forEach(sec => {
                if (scrollPos >= sec.offsetTop - offset) {
                    activeSectionId = sec.getAttribute('id');
                }
            });
        }
        
        navLinksList.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === `#${activeSectionId}`) {
                link.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', updateScrollSpy);
    window.addEventListener('resize', updateScrollSpy);
});
