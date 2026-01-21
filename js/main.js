const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
// It's a free API key! Not worth stealing lol, just create your own one for free at Last.fm!
const LASTFM_API_KEY = "609c049d1bbf19a3f327e670ad5b442b";
const DEBOUNCE_MS = 500;

let debounceTimer = null;

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    // Default to system preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light"
    );
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

// Listen for system theme changes
function watchSystemTheme() {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem("theme")) {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light"
        );
      }
    });
}

// Search Last.fm for tracks
async function searchMusic(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    method: "track.search",
    track: query,
    api_key: LASTFM_API_KEY,
    format: "json",
    limit: 10,
  });

  try {
    const response = await fetch(`${LASTFM_API}?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.results?.trackmatches?.track || [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// Get track info with tags from Last.fm
async function getTrackTags(artist, track) {
  const params = new URLSearchParams({
    method: "track.getTopTags",
    artist: artist,
    track: track,
    api_key: LASTFM_API_KEY,
    format: "json",
  });

  try {
    const response = await fetch(`${LASTFM_API}?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.toptags?.tag || [];
  } catch (error) {
    console.error("Get tags error:", error);
    return [];
  }
}

// Get the best image URL from track images array
function getTrackImage(images) {
  if (!images || images.length === 0) return null;
  // Prefer medium size (64px), fall back to small, then any available
  const medium = images.find((img) => img.size === "medium");
  if (medium && medium["#text"]) return medium["#text"];
  const small = images.find((img) => img.size === "small");
  if (small && small["#text"]) return small["#text"];
  // Return first available image
  const first = images.find((img) => img["#text"]);
  return first ? first["#text"] : null;
}

// Render search results
function renderSearchResults(tracks) {
  const container = document.getElementById("search-results");

  if (tracks.length === 0) {
    container.innerHTML = "";
    return;
  }

  const html = tracks
    .map((track) => {
      const imageUrl = getTrackImage(track.image);
      const lastfmUrl = track.url || "#";
      const imageHtml = imageUrl
        ? `<img class="result-image" src="${escapeAttr(
            imageUrl
          )}" alt="" loading="lazy">`
        : `<div class="result-image result-image-placeholder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>`;

      return `
      <div class="result-item" 
           data-artist="${escapeAttr(track.artist)}"
           data-track="${escapeAttr(track.name)}"
           data-url="${escapeAttr(lastfmUrl)}">
        ${imageHtml}
        <div class="result-info">
          <span class="result-title">${escapeHtml(track.name)}</span>
          <span class="result-artist">${escapeHtml(track.artist)}</span>
        </div>
        <a href="${escapeAttr(lastfmUrl)}" 
           class="result-lastfm" 
           target="_blank" 
           rel="noopener noreferrer"
           title="View on Last.fm"
           onclick="event.stopPropagation()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/>
          </svg>
        </a>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
}

// Render genre/tags display
function renderGenres(track, artist, tags, imageUrl, lastfmUrl) {
  const container = document.getElementById("genre-display");

  const tagHtml =
    tags.length > 0
      ? tags
          .slice(0, 10) // Show top 10 tags
          .map((t) => `<span class="genre-tag">${escapeHtml(t.name)}</span>`)
          .join("")
      : '<span class="no-genre">No genres found for this track</span>';

  const imageHtml = imageUrl
    ? `<img class="genre-result-image" src="${escapeAttr(imageUrl)}" alt="">`
    : `<div class="genre-result-image genre-result-image-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      </div>`;

  const lastfmLinkHtml = lastfmUrl
    ? `<a href="${escapeAttr(
        lastfmUrl
      )}" class="lastfm-link" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/>
        </svg>
        View on Last.fm
      </a>`
    : "";

  container.innerHTML = `
    <div class="genre-result">
      <div class="genre-result-header">
        ${imageHtml}
        <div class="genre-result-info">
          <h2>${escapeHtml(track)}</h2>
          <p class="artist-name">by ${escapeHtml(artist)}</p>
          ${lastfmLinkHtml}
        </div>
      </div>
      <div class="genres">
        <h3>Genres & Tags</h3>
        <div class="genre-list">${tagHtml}</div>
      </div>
    </div>
  `;
}

// Show loading state
function showLoading(container) {
  container.innerHTML = '<div class="loading">Finding genres...</div>';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Escape attribute values
function escapeAttr(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Handle search input
function handleSearchInput(event) {
  const query = event.target.value;

  clearTimeout(debounceTimer);

  if (query.trim().length < 2) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(async () => {
    const resultsContainer = document.getElementById("search-results");
    showLoading(resultsContainer);

    const tracks = await searchMusic(query);
    renderSearchResults(tracks);
  }, DEBOUNCE_MS);
}

// Handle result item click
async function handleResultClick(event) {
  // Don't handle if clicking the Last.fm link
  if (event.target.closest(".result-lastfm")) return;

  const resultItem = event.target.closest(".result-item");
  if (!resultItem) return;

  const artist = resultItem.dataset.artist;
  const track = resultItem.dataset.track;
  const lastfmUrl = resultItem.dataset.url;

  // Get the image URL from the result item
  const imgElement = resultItem.querySelector(".result-image");
  const imageUrl = imgElement && imgElement.src ? imgElement.src : null;
  // Use extralarge image for display if available (replace size in URL)
  const largeImageUrl = imageUrl
    ? imageUrl.replace("/64s/", "/300x300/").replace("/34s/", "/300x300/")
    : null;

  const genreContainer = document.getElementById("genre-display");
  showLoading(genreContainer);

  // Clear search results
  document.getElementById("search-results").innerHTML = "";
  document.getElementById("search-input").value = "";

  // Fetch tags from Last.fm
  const tags = await getTrackTags(artist, track);
  renderGenres(track, artist, tags, largeImageUrl, lastfmUrl);
}

// Close search results when clicking outside
function handleClickOutside(event) {
  const searchContainer = document.querySelector(".search-container");
  const searchResults = document.getElementById("search-results");

  if (searchContainer && !searchContainer.contains(event.target)) {
    searchResults.innerHTML = "";
  }
}

// Initialize event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme
  initTheme();
  watchSystemTheme();

  // Theme toggle
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Search functionality
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  if (searchInput) {
    searchInput.addEventListener("input", handleSearchInput);
  }

  if (searchResults) {
    searchResults.addEventListener("click", handleResultClick);
  }

  // Close results on outside click
  document.addEventListener("click", handleClickOutside);
});
