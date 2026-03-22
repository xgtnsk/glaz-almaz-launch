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
const leadForm = document.getElementById("lead-form");
const leadFormStatus = document.getElementById("lead-form-status");

const imageCache = [];
const mobileFrameStep = 2;
let loadedFrames = 0;
let totalFramesToLoad = frameCount;
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

function getFrameIndexes() {
  if (!isMobileViewport()) {
    return Array.from({ length: frameCount }, (_, index) => index);
  }

  const startFrame = getStartFrame();
  const indexes = [startFrame];

  for (let index = startFrame + mobileFrameStep; index < frameCount; index += mobileFrameStep) {
    indexes.push(index);
  }

  if (indexes[0] !== 0) {
    indexes.unshift(0);
  }

  if (indexes[indexes.length - 1] !== frameCount - 1) {
    indexes.push(frameCount - 1);
  }

  return indexes;
}

function getCachedFrameIndex(index) {
  if (!isMobileViewport()) {
    return index;
  }

  const startFrame = getStartFrame();

  if (index <= startFrame) {
    return startFrame;
  }

  const steppedIndex = startFrame + Math.round((index - startFrame) / mobileFrameStep) * mobileFrameStep;
  const clampedIndex = clamp(steppedIndex, startFrame, frameCount - 1);

  if (imageCache[clampedIndex]) {
    return clampedIndex;
  }

  for (let offset = 1; offset < frameCount; offset += 1) {
    const previous = clampedIndex - offset;
    const next = clampedIndex + offset;

    if (previous >= 0 && imageCache[previous]) {
      return previous;
    }

    if (next < frameCount && imageCache[next]) {
      return next;
    }
  }

  return startFrame;
}

function setLoaderProgress() {
  const progress = Math.round((loadedFrames / totalFramesToLoad) * 100);
  loaderBar.style.width = `${progress}%`;
  loaderValue.textContent = `${progress}%`;
  if (loadedFrames === totalFramesToLoad) {
    window.setTimeout(() => loader.classList.add("is-hidden"), 180);
  }
}

function preloadFrames() {
  const frameIndexes = getFrameIndexes();
  const jobs = [];
  const startFrame = getStartFrame();

  loadedFrames = 0;
  totalFramesToLoad = frameIndexes.length;
  activeFrame = -1;

  for (const index of frameIndexes) {
    jobs.push(
      new Promise((resolve) => {
        const image = new Image();
        image.src = framePath(index);
        image.onload = () => {
          imageCache[index] = image;
          loadedFrames += 1;
          setLoaderProgress();
          if (index === startFrame) {
            resizeCanvas();
            drawFrame(startFrame);
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
  const image = imageCache[getCachedFrameIndex(index)];
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
  if (isMobileViewport()) {
    const rect = storySection.getBoundingClientRect();
    const startLine = window.innerHeight * 0.84;
    const endLine = window.innerHeight * 0.18;
    const travel = rect.height + startLine - endLine;
    const rawProgress = clamp((startLine - rect.top) / Math.max(travel, 1), 0, 1);
    return clamp((rawProgress - 0.03) / 0.8, 0, 1);
  }

  const root = storyScrollArea || storySection;
  const frameRect = storyFrame.getBoundingClientRect();
  const holdLine = window.innerHeight * 0.52;

  if (frameRect.top > holdLine) {
    return 0;
  }

  const start = root.getBoundingClientRect().top + window.scrollY;
  const end = start + root.offsetHeight - window.innerHeight;
  const rawProgress = clamp((window.scrollY - start) / Math.max(end - start, 1), 0, 1);
  return clamp((rawProgress - 0.2) / 0.8, 0, 1);
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
  drawFrame(frameIndex);
  updateStoryCards(progress);
  updateStoryInterface(progress, frameIndex);
}

function animateStory() {
  storyAnimationFrame = 0;

  const delta = targetStoryProgress - currentStoryProgress;
  const mobile = isMobileViewport();
  const smoothing = mobile ? 0.1 : 0.2;

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

function setLeadFormStatus(message, state = "") {
  if (!leadFormStatus) {
    return;
  }

  leadFormStatus.textContent = message;
  leadFormStatus.classList.remove("is-error", "is-success");

  if (state) {
    leadFormStatus.classList.add(state);
  }
}

function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "").trim();
}

function initLeadForm() {
  if (!leadForm) {
    return;
  }

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const endpoint = leadForm.dataset.endpoint || "/api/lead";
    const submitButton = leadForm.querySelector('button[type="submit"]');
    const formData = new FormData(leadForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone: normalizePhone(String(formData.get("phone") || "")),
      message: String(formData.get("message") || "").trim(),
      page: window.location.href,
      source: "glaz-almaz-launch",
    };

    if (!payload.name || !payload.phone) {
      setLeadFormStatus("Заполни имя и телефон.", "is-error");
      return;
    }

    if (window.location.hostname.endsWith("github.io")) {
      setLeadFormStatus("Форма готова, отправка включится после переноса сайта на хостинг с backend.", "is-error");
      return;
    }

    submitButton.disabled = true;
    setLeadFormStatus("Отправляем заявку...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "send_failed");
      }

      leadForm.reset();
      setLeadFormStatus("Заявка отправлена. Проверь Telegram.", "is-success");
    } catch (error) {
      setLeadFormStatus("Не удалось отправить заявку. Backend подключим на новом хостинге.", "is-error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

function onScroll() {
  updateChrome();
  syncStoryProgress();
}

function onResize() {
  resizeCanvas();
  syncStoryProgress(true);
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onResize, { passive: true });

updateChrome();
initMetrics();
initAmbientBackground();
initLeadForm();
preloadFrames().then(() => {
  currentStoryProgress = getStoryProgress();
  targetStoryProgress = currentStoryProgress;
  syncStoryProgress(true);
  requestDraw();
});

if (sequenceVideo) {
  sequenceVideo.defaultMuted = true;
  sequenceVideo.muted = true;
  sequenceVideo.playsInline = true;

  sequenceVideo.addEventListener("loadeddata", () => {
    videoReady = true;
    syncStoryProgress(true);
  });
}
