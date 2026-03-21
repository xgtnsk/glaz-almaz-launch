const frameCount = 101;
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderValue = document.getElementById("loader-value");
const topbar = document.getElementById("topbar");
const progressBar = document.getElementById("scroll-progress");
const canvas = document.getElementById("sequence-canvas");
const context = canvas.getContext("2d");
const storySection = document.getElementById("story");
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
            drawFrame(0);
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
  const dpr = window.devicePixelRatio || 1;
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

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas;
  const scaledWidth = width / dpr;
  const scaledHeight = height / dpr;
  const imageRatio = image.width / image.height;
  const canvasRatio = scaledWidth / scaledHeight;
  const mobile = window.innerWidth < 820;

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
  const start = storySection.offsetTop;
  const end = start + storySection.offsetHeight - window.innerHeight;
  return clamp((window.scrollY - start) / (end - start), 0, 1);
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
    const frameIndex = Math.round(progress * (frameCount - 1));
    drawFrame(frameIndex);
    updateStoryCards(progress);
    updateStoryInterface(progress, frameIndex);
    pendingDraw = false;
  });
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
  requestDraw();
}

function onResize() {
  resizeCanvas();
  requestDraw();
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onResize, { passive: true });

updateChrome();
initMetrics();
initAmbientBackground();
preloadFrames().then(() => requestDraw());
