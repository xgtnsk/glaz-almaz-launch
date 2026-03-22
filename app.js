const frameCount = 101;
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderValue = document.getElementById("loader-value");
const topbar = document.getElementById("topbar");
const progressBar = document.getElementById("scroll-progress");
const canvas = document.getElementById("sequence-canvas");
const sequenceVideo = document.getElementById("sequence-video");
const context = canvas.getContext("2d");
const storySection = document.getElementById("story");
const storyScrollArea = document.querySelector(".story__scroll-area");
const storyFrame = document.querySelector(".story__frame");
const cards = Array.from(document.querySelectorAll(".story-card"));
const storyPills = Array.from(document.querySelectorAll(".story-pill"));
const storyMeterValue = document.getElementById("story-meter-value");
const storyProgressValue = document.getElementById("story-progress-value");
const metrics = Array.from(document.querySelectorAll(".metric__value"));
const ambientCanvas = document.getElementById("ambient-canvas");
const ambientContext = ambientCanvas.getContext("2d");

const imageCache = [];
let loadedFrames = 0;
let activeFrame = -1;
let pendingDraw = false;
let storyAnimationFrame = 0;
let targetStoryProgress = 0;
let currentStoryProgress = 0;
let videoReady = false;

function isMobileViewport() {
  return window.innerWidth < 820;
}

function getCanvasDpr() {
  const deviceDpr = window.devicePixelRatio || 1;
  return Math.min(deviceDpr, isMobileViewport() ? 1.35 : 2);
}

function getStartFrame() {
  return isMobileViewport() ? 8 : 0;
}

function framePath(index) {
  return `./frames/frame_${String(index + 1).padStart(3, "0")}.jpg`;
}

function setLoaderProgress() {
  const progress = Math.round((loadedFrames / frameCount) * 100);
  loaderBar.style.width = `${progress}%`;
  loaderValue.textContent = `${progress}%`;
  if (loadedFrames === frameCount) {
    window.setTimeout(() => loader.classList.add("is-hidden"), 180);
  }
}

function preloadFrames() {
  if (isMobileViewport()) {
    loadedFrames = frameCount;
    setLoaderProgress();
    if (sequenceVideo) {
      sequenceVideo.currentTime = 0;
      sequenceVideo.pause();
      sequenceVideo.load();
    }
    return Promise.resolve();
  }

  const jobs = [];

  for (let index = 0; index < frameCount; index += 1) {
    jobs.push(
      new Promise((resolve) => {
        const image = new Image();
        image.src = framePath(index);
        image.onload = () => {
          imageCache[index] = image;
          loadedFrames += 1;
          setLoaderProgress();
          if (index === 0) {
            resizeCanvas();
            drawFrame(getStartFrame());
          }
          resolve();
        };
        image.onerror = () => {
          loadedFrames += 1;
          setLoaderProgress();
          resolve();
        };
      }),
    );
  }

  return Promise.all(jobs);
}

function resizeCanvas() {
  const dpr = getCanvasDpr();
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
}

function drawFrame(index) {
  const image = imageCache[index];
  if (!image || index === activeFrame) {
    return;
  }

  activeFrame = index;

  const dpr = getCanvasDpr();
  const { width, height } = canvas;
  const scaledWidth = width / dpr;
  const scaledHeight = height / dpr;
  const imageRatio = image.width / image.height;
  const canvasRatio = scaledWidth / scaledHeight;
  const mobile = isMobileViewport();

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.scale(dpr, dpr);

  let drawWidth;
  let drawHeight;

  if (mobile) {
    const containScale = Math.min(scaledWidth / image.width, scaledHeight / image.height) * 1.08;
    drawWidth = image.width * containScale;
    drawHeight = image.height * containScale;
  } else if (imageRatio > canvasRatio) {
    drawHeight = scaledHeight;
    drawWidth = drawHeight * imageRatio;
  } else {
    drawWidth = scaledWidth;
    drawHeight = drawWidth / imageRatio;
  }

  const offsetX = (scaledWidth - drawWidth) / 2;
  const offsetY = (scaledHeight - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStoryProgress() {
  const root = storyScrollArea || storySection;
  const start = root.offsetTop;
  const end = start + root.offsetHeight - window.innerHeight;
  return clamp((window.scrollY - start) / Math.max(end - start, 1), 0, 1);
}

function syncVideoFrame(progress) {
  if (!sequenceVideo || !videoReady || !sequenceVideo.duration) {
    return;
  }

  const startOffset = getStartFrame() / (frameCount - 1);
  const mappedProgress = startOffset + clamp(progress, 0, 1) * (1 - startOffset);
  const targetTime = mappedProgress * sequenceVideo.duration;

  if (Math.abs(sequenceVideo.currentTime - targetTime) > 0.04) {
    sequenceVideo.currentTime = targetTime;
  }
}

function updateStoryCards(progress) {
  cards.forEach((card) => {
    const start = Number(card.dataset.start);
    const end = Number(card.dataset.end);
    card.classList.toggle("active", progress >= start && progress <= end);
  });
}

function updateStoryInterface(progress, frameIndex) {
  if (storyMeterValue) {
    storyMeterValue.textContent = String(frameIndex + 1).padStart(3, "0");
  }

  if (storyProgressValue) {
    storyProgressValue.textContent = `${Math.round(progress * 100)}%`;
  }

  storySection.style.setProperty("--story-progress", progress.toFixed(3));

  storyPills.forEach((pill) => {
    const start = Number(pill.dataset.start);
    const end = Number(pill.dataset.end);
    pill.classList.toggle("active", progress >= start && progress <= end);
  });
}

function requestDraw() {
  if (isMobileViewport()) {
    return;
  }

  if (pendingDraw) {
    return;
  }

  pendingDraw = true;
  window.requestAnimationFrame(() => {
    const progress = getStoryProgress();
    const startFrame = getStartFrame();
    const frameIndex = Math.round(startFrame + progress * (frameCount - 1 - startFrame));
    drawFrame(frameIndex);
    updateStoryCards(progress);
    updateStoryInterface(progress, frameIndex);
    pendingDraw = false;
  });
}

function drawStoryAtProgress(progress) {
  const startFrame = getStartFrame();
  const frameIndex = Math.round(startFrame + progress * (frameCount - 1 - startFrame));

  if (isMobileViewport()) {
    syncVideoFrame(progress);
  } else {
    drawFrame(frameIndex);
  }

  updateStoryCards(progress);
  updateStoryInterface(progress, frameIndex);
}

function animateStory() {
  storyAnimationFrame = 0;

  const delta = targetStoryProgress - currentStoryProgress;
  const mobile = isMobileViewport();
  const smoothing = mobile ? 0.14 : 0.2;

  if (Math.abs(delta) < 0.0015) {
    currentStoryProgress = targetStoryProgress;
    drawStoryAtProgress(currentStoryProgress);
    return;
  }

  currentStoryProgress += delta * smoothing;
  drawStoryAtProgress(currentStoryProgress);
  storyAnimationFrame = window.requestAnimationFrame(animateStory);
}

function syncStoryProgress(immediate = false) {
  targetStoryProgress = getStoryProgress();

  if (immediate) {
    currentStoryProgress = targetStoryProgress;
    drawStoryAtProgress(currentStoryProgress);
    return;
  }

  if (!storyAnimationFrame) {
    storyAnimationFrame = window.requestAnimationFrame(animateStory);
  }
}

function updateChrome() {
  const scrolled = window.scrollY > 32;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const documentProgress = total > 0 ? (window.scrollY / total) * 100 : 0;

  topbar.classList.toggle("compact", scrolled);
  progressBar.style.width = `${documentProgress}%`;
}

function animateMetric(node) {
  const target = Number(node.dataset.target);
  const duration = 1200;
  const startAt = performance.now();

  function tick(now) {
    const elapsed = now - startAt;
    const progress = clamp(elapsed / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    node.textContent = `${Math.round(target * eased)}`;
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  }

  window.requestAnimationFrame(tick);
}

function initMetrics() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateMetric(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );

  metrics.forEach((metric) => observer.observe(metric));
}

function initAmbientBackground() {
  const particles = Array.from({ length: 56 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 2.4 + 0.6,
    speedX: (Math.random() - 0.5) * 0.00028,
    speedY: Math.random() * 0.00032 + 0.00006,
    alpha: Math.random() * 0.45 + 0.16,
  }));

  function resizeAmbient() {
    const dpr = window.devicePixelRatio || 1;
    ambientCanvas.width = Math.round(window.innerWidth * dpr);
    ambientCanvas.height = Math.round(window.innerHeight * dpr);
    ambientContext.setTransform(1, 0, 0, 1, 0, 0);
    ambientContext.scale(dpr, dpr);
  }

  function drawAmbient() {
    ambientContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((particle) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.x < -0.05) particle.x = 1.05;
      if (particle.x > 1.05) particle.x = -0.05;
      if (particle.y > 1.05) particle.y = -0.05;

      const x = particle.x * window.innerWidth;
      const y = particle.y * window.innerHeight;

      ambientContext.beginPath();
      ambientContext.fillStyle = `rgba(79, 128, 168, ${particle.alpha})`;
      ambientContext.arc(x, y, particle.radius, 0, Math.PI * 2);
      ambientContext.fill();

      ambientContext.beginPath();
      ambientContext.strokeStyle = `rgba(144, 197, 234, ${particle.alpha * 0.44})`;
      ambientContext.moveTo(x - 6, y);
      ambientContext.lineTo(x + 6, y);
      ambientContext.moveTo(x, y - 6);
      ambientContext.lineTo(x, y + 6);
      ambientContext.stroke();
    });

    window.requestAnimationFrame(drawAmbient);
  }

  resizeAmbient();
  drawAmbient();
  window.addEventListener("resize", resizeAmbient, { passive: true });
}

function onScroll() {
  updateChrome();
  syncStoryProgress();
}

function onResize() {
  if (!isMobileViewport()) {
    resizeCanvas();
  }

  syncStoryProgress(true);
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onResize, { passive: true });

updateChrome();
initMetrics();
initAmbientBackground();
preloadFrames().then(() => {
  currentStoryProgress = getStoryProgress();
  targetStoryProgress = currentStoryProgress;
  syncStoryProgress(true);

  if (!isMobileViewport()) {
    requestDraw();
  }
});

if (sequenceVideo) {
  sequenceVideo.defaultMuted = true;
  sequenceVideo.muted = true;
  sequenceVideo.playsInline = true;

  sequenceVideo.addEventListener("loadeddata", () => {
    videoReady = true;
    if (isMobileViewport()) {
      sequenceVideo
        .play()
        .then(() => {
          sequenceVideo.pause();
          syncStoryProgress(true);
        })
        .catch(() => {
          syncStoryProgress(true);
        });
      return;
    }

    syncStoryProgress(true);
  });
}
