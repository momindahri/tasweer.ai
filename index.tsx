/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// FIX: Removed unused and potentially deprecated imports `GeneratedImage` and `PersonGeneration` to align with Gemini API guidelines.
import {GoogleGenAI} from '@google/genai';

// --- INTERFACES ---
interface HistoryItem {
  id: number;
  prompt: string;
  settings: {
    style: string;
    creativity: number;
    aspectRatio: string;
    numImages: number;
    model: string;
  };
  images: string[]; // Array of base64 jpeg data URLs
}

// --- DOM ELEMENT REFERENCES ---
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const stylePresetSelect = document.getElementById('style-preset-select') as HTMLSelectElement;
const creativitySlider = document.getElementById('creativity-slider') as HTMLInputElement;
const creativityValue = document.getElementById('creativity-value') as HTMLOutputElement;
const aspectRatioSelector = document.getElementById('aspect-ratio-selector');
const numImagesSelector = document.getElementById('num-images-selector');
const imageGallery = document.getElementById('image-gallery');
const promptInputWrapper = document.getElementById('prompt-input-wrapper');
const clearPromptButton = document.getElementById('clear-prompt-button') as HTMLButtonElement;
const charCounter = document.getElementById('char-counter');
const historyList = document.getElementById('history-list');
const clearHistoryButton = document.getElementById('clear-history-button') as HTMLButtonElement;
const galleryWelcome = document.getElementById('gallery-welcome');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImage = lightbox?.querySelector('.lightbox-image') as HTMLImageElement;
const lightboxDownload = lightbox?.querySelector('.lightbox-download') as HTMLAnchorElement;
const lightboxClose = lightbox?.querySelector('.lightbox-close');
const lightboxPrev = lightbox?.querySelector('.lightbox-nav.prev');
const lightboxNext = lightbox?.querySelector('.lightbox-nav.next');


const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- STATE ---
let history: HistoryItem[] = [];
let currentLightboxImages: string[] = [];
let currentLightboxIndex = 0;

// -------------------- CHOOSE AN IMAGEN MODEL -------------------------------------------------
const selectedModel = 'imagen-4.0-generate-001';

// -------------------- DEFAULT PROMPT -------------------------------------------------
const defaultPrompt = 'Editorial wildlife photograph: a sleek black panther standing regally on a reflective salt flat at dusk, wearing a dramatic, sculptural couture gown inspired by organic forms. The landscape is vast and otherworldly but grounded in reality, with subtle shimmering textures and a warm, golden-hour glow. Captured with a cinematic 35mm lens, shallow depth of field, natural shadows, and authentic fur and fabric textures—evoking a high-fashion magazine cover with a surreal, yet believable, atmosphere.';

// --- TOAST NOTIFICATION FUNCTION ---
function showToast(messageHTML: string, duration: number = 5000) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.innerHTML = messageHTML;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// --- HELPER TO GET CREATIVITY KEYWORDS ---
function getCreativityKeywords(strength: number): string {
    if (strength < 30) return '';
    if (strength < 70) return 'artistic, creative interpretation, ';
    return 'highly imaginative, surreal, abstract interpretation, pushing creative boundaries, ';
}

// --- HISTORY FUNCTIONS ---
function loadHistory() {
  const savedHistory = localStorage.getItem('imageGenHistory');
  if (savedHistory) history = JSON.parse(savedHistory);
  renderHistory();
}

function saveHistory() {
  localStorage.setItem('imageGenHistory', JSON.stringify(history));
}

function addToHistory(item: HistoryItem) {
  history.unshift(item);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = history.length === 0 
    ? `<p class="empty-history-message">Your generation history will appear here.</p>`
    : '';

  if (history.length === 0) return;

  history.forEach(item => {
    const historyItemElement = document.createElement('div');
    historyItemElement.className = 'history-item';
    historyItemElement.innerHTML = `
      <img src="${item.images[0]}" alt="History thumbnail" class="history-item-thumbnail">
      <div class="history-item-info"><p class="history-item-prompt">${item.prompt}</p></div>
      <div class="history-item-actions">
        <button class="history-action-button reuse" title="Reuse Settings"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8m0 8h6v-6"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/></svg></button>
        <button class="history-action-button delete" title="Delete Entry"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
      </div>`;

    historyItemElement.querySelector('.history-item-info')?.addEventListener('click', () => displayImagesInGallery(item.images, item.prompt));
    
    historyItemElement.querySelector('.reuse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      promptInput.value = item.prompt;
      stylePresetSelect.value = item.settings.style;
      creativitySlider.value = String(item.settings.creativity);
      
      // Update visual selectors
      updateVisualSelector(aspectRatioSelector, item.settings.aspectRatio);
      updateVisualSelector(numImagesSelector, String(item.settings.numImages));
      
      document.querySelector('.tab-button[data-tab="controls-content"]')?.dispatchEvent(new Event('click'));
      promptInput.dispatchEvent(new Event('input'));
      creativitySlider.dispatchEvent(new Event('input'));
      promptInput.focus();
    });

    historyItemElement.querySelector('.delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      history = history.filter(h => h.id !== item.id);
      saveHistory();
      renderHistory();
    });

    historyList.appendChild(historyItemElement);
  });
}

function displayImagesInGallery(images: string[], prompt: string) {
    if (!imageGallery) return;
    imageGallery.innerHTML = ''; // Clear gallery

    images.forEach((base64Image, index) => {
        const container = document.createElement('div');
        container.className = 'image-container';
        container.dataset.index = String(index);

        const img = new Image();
        img.src = base64Image;
        img.alt = `${prompt} - Image ${index + 1}`;

        const downloadIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        const downloadLink = document.createElement('a');
        downloadLink.href = base64Image;
        downloadLink.download = `tasweer-ai-image-${Date.now()}-${index + 1}.jpeg`;
        downloadLink.className = 'download-button';
        downloadLink.innerHTML = downloadIconSVG;
        downloadLink.setAttribute('role', 'button');
        downloadLink.setAttribute('aria-label', `Download image ${index + 1}`);
        downloadLink.addEventListener('click', (e) => e.stopPropagation());

        container.appendChild(img);
        container.appendChild(downloadLink);
        imageGallery.appendChild(container);
    });

    currentLightboxImages = images; // Store images for lightbox
}

// --- LIGHTBOX FUNCTIONS ---
function openLightbox(index: number) {
  if (!lightbox || !lightboxImage || !lightboxDownload) return;
  currentLightboxIndex = index;
  lightboxImage.src = currentLightboxImages[index];
  lightboxDownload.href = currentLightboxImages[index];
  lightboxDownload.download = `tasweer-ai-image-${Date.now()}-${index + 1}.jpeg`;
  lightbox.classList.add('show');
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('show');
  document.body.classList.remove('lightbox-open');
}

function showNextImage() {
  const newIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
  openLightbox(newIndex);
}

function showPrevImage() {
  const newIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
  openLightbox(newIndex);
}

// --- MAIN GENERATION FUNCTION ---
async function generateAndDisplayImages(userPrompt: string) {
  if (!userPrompt || !imageGallery || !generateButton) return;
  
  generateButton.disabled = true;
  imageGallery.innerHTML = ''; 

  // FIX: Cast querySelector result to HTMLElement to access dataset property.
  const selectedAspectRatio = (aspectRatioSelector?.querySelector('.active') as HTMLElement)?.dataset.value || '1:1';
  // FIX: Cast querySelector result to HTMLElement to access dataset property.
  const selectedNumImages = parseInt((numImagesSelector?.querySelector('.active') as HTMLElement)?.dataset.value || '3', 10);
  const selectedStyle = stylePresetSelect.value;
  const creativityStrength = parseInt(creativitySlider.value, 10);

  for (let i = 0; i < selectedNumImages; i++) {
    const container = document.createElement('div');
    container.className = 'image-container';
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    const [width, height] = selectedAspectRatio.split(':');
    placeholder.style.aspectRatio = `${width} / ${height}`;
    container.appendChild(placeholder);
    imageGallery.appendChild(container);
  }

  const creativityKeywords = getCreativityKeywords(creativityStrength);
  const styleKeywords: {[key: string]: string} = {
      'photorealistic': 'photorealistic, 8k, detailed, professional photography, ',
      'anime': 'anime style, vibrant, detailed illustration, key visual, ',
      'digital-art': 'digital art, fantasy, intricate, elegant, highly detailed, ',
      'watercolor': 'watercolor painting, vibrant colors, soft edges, paper texture, ',
  };
  
  let finalPrompt = selectedStyle !== 'none' && styleKeywords[selectedStyle] ? styleKeywords[selectedStyle] + userPrompt : userPrompt;
  finalPrompt = creativityKeywords + finalPrompt;

  try {
      // FIX: Removed unsupported config parameters `personGeneration` and `includeRaiReason` to align with Gemini API guidelines.
      const response = await ai.models.generateImages({
        model: selectedModel,
        prompt: finalPrompt,
        config: {
            numberOfImages: selectedNumImages,
            aspectRatio: selectedAspectRatio,
            outputMimeType: 'image/jpeg',
        },
      });

      if (response?.generatedImages && response.generatedImages.length > 0) {
          const generatedImageUrls = response.generatedImages.map(img => `data:image/jpeg;base64,${img.image?.imageBytes}`);
          displayImagesInGallery(generatedImageUrls, userPrompt);
          
          addToHistory({
            id: Date.now(), prompt: userPrompt,
            settings: { style: selectedStyle, creativity: creativityStrength, aspectRatio: selectedAspectRatio, numImages: selectedNumImages, model: selectedModel },
            images: generatedImageUrls
          });
      } else {
        imageGallery.innerHTML = `<div class="gallery-info-message"><p>No images were generated. This may be due to safety filters. Please try a different prompt.</p></div>`;
      }
      console.log('Full response:', response);
  } catch (error) {
      console.error("Error generating images:", error);
      imageGallery.innerHTML = '';
      if (galleryWelcome) imageGallery.appendChild(galleryWelcome.cloneNode(true));
          
      let errorMessageHTML = '<strong>Error:</strong> Could not load images. Please check the console for details.';
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
          errorMessageHTML = `<strong>API Quota Exceeded</strong><p>Please check your plan and billing details. <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer">Learn more</a></p>`;
      }
      showToast(errorMessageHTML);
  } finally {
      generateButton.disabled = false;
  }
}

// --- EVENT LISTENERS AND INITIALIZATION ---
function updateVisualSelector(container: HTMLElement | null, value: string) {
    if (!container) return;
    container.querySelectorAll('.visual-selector-button').forEach(btn => {
        // FIX: Cast Element to HTMLElement to access dataset property.
        btn.classList.toggle('active', (btn as HTMLElement).dataset.value === value);
    });
}

function initializeApp() {
    const requiredElements = [promptInput, generateButton, stylePresetSelect, charCounter, clearPromptButton, promptInputWrapper, creativitySlider, creativityValue, historyList, clearHistoryButton, aspectRatioSelector, numImagesSelector, galleryWelcome, lightbox];
    if (requiredElements.some(el => !el)) {
      console.error("Initialization failed: A required DOM element was not found.");
      return;
    }

    promptInput.value = defaultPrompt;
    promptInput.dispatchEvent(new Event('input'));
    creativitySlider.dispatchEvent(new Event('input')); // Set initial value display

    generateButton.addEventListener('click', () => {
        const userPrompt = promptInput.value.trim();
        if (userPrompt) generateAndDisplayImages(userPrompt);
    });
    
    promptInput.addEventListener('input', () => {
        const length = promptInput.value.length;
        charCounter.textContent = String(length);
        promptInputWrapper.classList.toggle('has-content', length > 0);
    });

    clearPromptButton.addEventListener('click', () => {
        promptInput.value = '';
        promptInput.focus();
        promptInput.dispatchEvent(new Event('input'));
    });

    creativitySlider.addEventListener('input', () => {
      creativityValue.textContent = creativitySlider.value;
    });

    // Visual Selector Logic
    [aspectRatioSelector, numImagesSelector].forEach(container => {
        container?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.visual-selector-button');
            if (button) {
                // FIX: Cast Element to HTMLElement to access dataset property.
                updateVisualSelector(container, (button as HTMLElement).dataset.value || '');
            }
        });
    });

    // Tab switching
    const tabsContainer = document.querySelector('.tabs');
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab');
        
        // Update button active state
        document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        
        // Update content active state
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById(tab!)?.classList.add('active');

        // Update slider position
        if (tab === 'history-content') {
            tabsContainer?.classList.add('history-active');
        } else {
            tabsContainer?.classList.remove('history-active');
        }
      });
    });

    clearHistoryButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all generation history?')) {
        history = [];
        saveHistory();
        renderHistory();
      }
    });

    // Lightbox events
    imageGallery?.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const imageContainer = target.closest<HTMLElement>('.image-container');
        if (imageContainer && imageContainer.dataset.index) {
            openLightbox(parseInt(imageContainer.dataset.index, 10));
        }
    });

    lightboxClose?.addEventListener('click', closeLightbox);
    lightboxPrev?.addEventListener('click', showPrevImage);
    lightboxNext?.addEventListener('click', showNextImage);
    document.addEventListener('keydown', e => {
      if (lightbox?.classList.contains('show')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNextImage();
        if (e.key === 'ArrowLeft') showPrevImage();
      }
    });

    loadHistory();
}

initializeApp();