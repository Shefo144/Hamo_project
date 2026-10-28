const $ = (id) => document.getElementById(id);

const SKILL_FIELDS = [
    "position", "minAge", "maxAge",
    "minOVR", "minPAC", "minSHO", "minPAS",
    "minDRI", "minDEF", "minPHY",
    "minAcceleration", "minSprint", "minFinishing",
    "minShotPower", "minLongShots", "minVision",
    "minShortPassing", "minDribbling", "minBallControl",
    "minStamina", "minStrength",
    "nation", "league", "team", "preferredFoot"
];

const PAGE_SIZE = 24;

let currentPage = "homePage";
let nameTimer = null;
let nameRequestNumber = 0;
let skillsPage = 1;
let allPage = 1;
let skillsRequestNumber = 0;
let allRequestNumber = 0;
let optionsLoaded = false;


// ---------------- INTRO ----------------

function finishIntro() {
    const intro = $("intro");

    if (intro) {
        intro.classList.add("finished");
    }
}

if ($("skipIntro")) {
    $("skipIntro").addEventListener("click", finishIntro);
}

setTimeout(finishIntro, 3500);


// ---------------- NAVIGATION ----------------

function showPage(pageId) {
    const targetPage = $(pageId);

    if (!targetPage) {
        console.error("Page not found:", pageId);
        return;
    }

    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    targetPage.classList.remove("hidden");
    currentPage = pageId;

    if ($("suggestions")) {
        $("suggestions").classList.add("hidden");
        $("suggestions").replaceChildren();
    }

    if ($("profileModal")) {
        $("profileModal").classList.add("hidden");
        document.body.style.overflow = "";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (pageId === "skillsPage") {
        loadSkills(1);
    }

    if (pageId === "allPage") {
        loadAllPlayers(1);
    }

    if (pageId === "namePage") {
        setTimeout(() => {
            if ($("nameSearch")) {
                $("nameSearch").focus();
            }
        }, 150);
    }
}

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault();

        const pageId = button.dataset.page;

        if (pageId) {
            showPage(pageId);
        }
    });
});

document.addEventListener("click", event => {
    const homeElement = event.target.closest(
        "#homeButton, [data-home], a[href='#homePage']"
    );

    if (homeElement) {
        event.preventDefault();
        showPage("homePage");
    }
});


// ---------------- API HELPERS ----------------

async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

function showError(container, message) {
    if (!container) return;

    container.replaceChildren();

    const error = document.createElement("div");
    error.className = "empty-state";
    error.textContent = message;

    container.appendChild(error);
}

function makeOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;

    select.appendChild(option);
}


// ---------------- DROPDOWN OPTIONS ----------------

async function loadOptions() {
    try {
        const data = await fetchJSON("/options");

        fillSelect("nation", data.nations || [], "All Nations");
        fillSelect("league", data.leagues || [], "All Leagues");
        fillSelect("team", data.teams || [], "All Teams");

        optionsLoaded = true;
    } catch (error) {
        console.error("Options error:", error);

        if ($("skillsCount")) {
            $("skillsCount").textContent =
                "Could not load filter options";
        }
    }
}

function fillSelect(id, items, defaultText) {
    const select = $(id);

    if (!select) return;

    select.replaceChildren();
    makeOption(select, "", defaultText);

    items.forEach(item => {
        if (
            item &&
            String(item).toLowerCase() !== "nan"
        ) {
            makeOption(select, item, item);
        }
    });
}


// ---------------- PLAYER IMAGE ----------------

function createPlayerImage(player, className) {
    const wrapper = document.createElement("div");
    wrapper.className = className;

    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.textContent = "⚽";

    const image = document.createElement("img");
    image.className = "player-image";
    image.alt = player.Name || "Football player";
    image.loading = "lazy";

    image.addEventListener("error", () => {
        image.remove();
        wrapper.replaceChildren(fallback);
    }, { once: true });

    wrapper.appendChild(fallback);

    if (
        player.card &&
        /^https?:\/\//i.test(player.card)
    ) {
        image.src = player.card;
        wrapper.replaceChildren(image);
    }

    return wrapper;
}


// ---------------- PLAYER CARD ----------------

function createPlayerCard(player) {
    const card = document.createElement("article");
    card.className = "player-card";

    const top = document.createElement("div");
    top.className = "player-card-top";

    const rating = document.createElement("span");
    rating.className = "player-rating";
    rating.textContent = player.OVR || "N/A";

    const position = document.createElement("span");
    position.className = "player-position";
    position.textContent = player.Position || "N/A";

    top.append(rating, position);
    card.appendChild(top);

    card.appendChild(
        createPlayerImage(player, "player-image-wrap")
    );

    const name = document.createElement("h3");
    name.className = "player-name";
    name.textContent = player.Name || "Unknown Player";
    card.appendChild(name);

    const team = document.createElement("div");
    team.className = "player-team";

    team.textContent = [
        player.Team,
        player.Nation
    ].filter(Boolean).join(" · ") || "Team unavailable";

    card.appendChild(team);

    const stats = document.createElement("div");
    stats.className = "player-stats";

    [
        ["PAC", player.PAC],
        ["SHO", player.SHO],
        ["PAS", player.PAS]
    ].forEach(([label, value]) => {
        const stat = document.createElement("div");
        stat.className = "stat";

        const strong = document.createElement("strong");
        strong.textContent = value || "—";

        const small = document.createElement("span");
        small.textContent = label;

        stat.append(strong, small);
        stats.appendChild(stat);
    });

    card.appendChild(stats);

    const button = document.createElement("button");
    button.className = "view-profile";
    button.textContent = "VIEW PROFILE ↗";

    button.addEventListener("click", () => {
        openProfile(player.ID);
    });

    card.appendChild(button);

    return card;
}

function displayPlayers(container, players) {
    if (!container) return;

    container.replaceChildren();

    if (!players || !players.length) {
        showError(
            container,
            "No players found. Try different filters."
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    players.forEach(player => {
        fragment.appendChild(createPlayerCard(player));
    });

    container.appendChild(fragment);
}


// ---------------- PAGINATION ----------------

function renderPagination(
    containerId,
    current,
    totalPages,
    onChange
) {
    const container = $(containerId);

    if (!container) return;

    container.replaceChildren();

    if (totalPages <= 1) return;

    function addButton(text, page, disabled, active = false) {
        const button = document.createElement("button");
        button.textContent = text;
        button.disabled = disabled;

        if (active) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            onChange(page);
        });

        container.appendChild(button);
    }

    addButton("←", current - 1, current <= 1);

    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);

    if (start > 1) {
        addButton("1", 1, false, current === 1);

        if (start > 2) {
            const dots = document.createElement("span");
            dots.textContent = "…";
            dots.style.padding = "10px";
            container.appendChild(dots);
        }
    }

    for (let page = start; page <= end; page++) {
        addButton(
            String(page),
            page,
            false,
            page === current
        );
    }

    if (end < totalPages) {
        if (end < totalPages - 1) {
            const dots = document.createElement("span");
            dots.textContent = "…";
            dots.style.padding = "10px";
            container.appendChild(dots);
        }

        addButton(
            String(totalPages),
            totalPages,
            false,
            current === totalPages
        );
    }

    addButton("→", current + 1, current >= totalPages);
}


// ---------------- SEARCH BY NAME ----------------

if ($("nameSearch")) {
    $("nameSearch").addEventListener("input", () => {
        clearTimeout(nameTimer);

        const query = $("nameSearch").value.trim();
        const requestNumber = ++nameRequestNumber;

        $("suggestions").replaceChildren();
        $("suggestions").classList.add("hidden");
        $("nameResults").replaceChildren();

        if (!query) {
            $("nameStatus").textContent =
                "Start typing to find a player.";
            return;
        }

        $("nameStatus").textContent = "Searching players...";

        nameTimer = setTimeout(() => {
            searchSuggestions(query, requestNumber);
        }, 180);
    });
}

async function searchSuggestions(query, requestNumber) {
    try {
        const players = await fetchJSON(
            "/suggest?q=" + encodeURIComponent(query)
        );

        if (requestNumber !== nameRequestNumber) return;

        const container = $("suggestions");
        container.replaceChildren();

        if (!players.length) {
            $("nameStatus").textContent =
                "No matching players found.";

            container.classList.add("hidden");
            return;
        }

        $("nameStatus").textContent =
            `Found ${players.length} suggestions. Select a player.`;

        players.forEach(player => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "suggestion-item";

            button.appendChild(
                createPlayerImage(player, "suggestion-image")
            );

            const info = document.createElement("span");
            info.className = "suggestion-info";

            const name = document.createElement("strong");
            name.textContent = player.Name || "Unknown Player";

            const details = document.createElement("small");
            details.textContent =
                `${player.Team || "Unknown team"} · ${player.Position || "N/A"}`;

            info.append(name, details);

            const rating = document.createElement("span");
            rating.className = "suggestion-rating";
            rating.textContent = player.OVR || "—";

            button.append(info, rating);

            button.addEventListener("click", () => {
                $("nameSearch").value = player.Name || "";

                container.classList.add("hidden");
                container.replaceChildren();

                $("nameStatus").textContent = "Selected player";

                displayPlayers($("nameResults"), [player]);
            });

            container.appendChild(button);
        });

        container.classList.remove("hidden");
    } catch (error) {
        if (requestNumber !== nameRequestNumber) return;

        console.error("Name search error:", error);

        $("nameStatus").textContent =
            "Could not connect to the server.";
    }
}

if ($("clearName")) {
    $("clearName").addEventListener("click", () => {
        $("nameSearch").value = "";
        $("suggestions").replaceChildren();
        $("suggestions").classList.add("hidden");
        $("nameResults").replaceChildren();

        $("nameStatus").textContent =
            "Start typing to find a player.";

        $("nameSearch").focus();
    });
}

document.addEventListener("click", event => {
    if (
        !event.target.closest(".search-box") &&
        $("suggestions")
    ) {
        $("suggestions").classList.add("hidden");
    }
});


// ---------------- SEARCH BY SKILLS ----------------

function getSkillParams() {
    const params = new URLSearchParams();

    SKILL_FIELDS.forEach(id => {
        const element = $(id);

        if (
            element &&
            element.value.trim() !== ""
        ) {
            params.set(id, element.value.trim());
        }
    });

    return params;
}

async function loadSkills(page = 1) {
    skillsPage = page;

    const requestNumber = ++skillsRequestNumber;
    const container = $("skillsResults");

    container.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Finding matching players...";
    container.appendChild(loading);

    $("skillsCount").textContent = "Loading...";
    $("skillsPagination").replaceChildren();

    try {
        await loadOptionsIfNeeded();

        const params = getSkillParams();
        params.set("page", page);
        params.set("per_page", PAGE_SIZE);

        const data = await fetchJSON(
            "/players?" + params.toString()
        );

        if (requestNumber !== skillsRequestNumber) return;

        $("skillsCount").textContent =
            `${data.total.toLocaleString()} players`;

        displayPlayers(container, data.players);

        renderPagination(
            "skillsPagination",
            data.page,
            data.total_pages,
            nextPage => loadSkills(nextPage)
        );
    } catch (error) {
        if (requestNumber !== skillsRequestNumber) return;

        console.error("Skills search error:", error);

        $("skillsCount").textContent = "Search failed";

        showError(
            container,
            "Could not load players. Check that Flask is running."
        );
    }
}

if ($("searchSkills")) {
    $("searchSkills").addEventListener("click", () => {
        loadSkills(1);
    });
}

if ($("resetSkills")) {
    $("resetSkills").addEventListener("click", () => {
        SKILL_FIELDS.forEach(id => {
            const element = $(id);

            if (element) {
                element.value = "";
            }
        });

        loadSkills(1);
    });
}


// ---------------- ALL PLAYERS ----------------

async function loadAllPlayers(page = 1) {
    allPage = page;

    const requestNumber = ++allRequestNumber;
    const container = $("allResults");

    container.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading player database...";
    container.appendChild(loading);

    $("allCount").textContent = "Loading...";
    $("allPagination").replaceChildren();

    try {
        const params = new URLSearchParams({
            page: String(page),
            per_page: String(PAGE_SIZE)
        });

        const data = await fetchJSON(
            "/all-players?" + params.toString()
        );

        if (requestNumber !== allRequestNumber) return;

        $("allCount").textContent =
            `${data.total.toLocaleString()} players`;

        displayPlayers(container, data.players);

        renderPagination(
            "allPagination",
            data.page,
            data.total_pages,
            nextPage => loadAllPlayers(nextPage)
        );
    } catch (error) {
        if (requestNumber !== allRequestNumber) return;

        console.error("All players error:", error);

        $("allCount").textContent = "Loading failed";

        showError(
            container,
            "Could not load the player database."
        );
    }
}


// ---------------- PLAYER PROFILE ----------------

async function openProfile(playerId) {
    if (!playerId) return;

    const modal = $("profileModal");
    const content = $("profileContent");

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    content.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading player profile...";
    content.appendChild(loading);

    try {
        const player = await fetchJSON(
            "/player/" + encodeURIComponent(playerId)
        );

        renderProfile(player);
    } catch (error) {
        console.error("Profile error:", error);

        showError(
            content,
            "Could not load this player profile."
        );
    }
}

function renderProfile(player) {
    const content = $("profileContent");
    content.replaceChildren();

    const header = document.createElement("div");
    header.className = "profile-header";

    const image = document.createElement("img");
    image.alt = player.Name || "Football player";

    if (player.card && /^https?:\/\//i.test(player.card)) {
        image.src = player.card;
    } else {
        image.alt = "Player image unavailable";
    }

    image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.alt = "Player image unavailable";
    }, { once: true });

    const info = document.createElement("div");

    const name = document.createElement("h1");
    name.textContent = player.Name || "Unknown Player";

    const position = document.createElement("p");
    position.textContent =
        `${player.Position || "N/A"} · ${player.Team || "Unknown team"}`;

    const overall = document.createElement("div");
    overall.className = "profile-overall";
    overall.textContent = player.OVR || "N/A";

    const overallLabel = document.createElement("p");
    overallLabel.textContent = "OVERALL RATING";

    info.append(name, position, overall, overallLabel);
    header.append(image, info);
    content.appendChild(header);

    const youtubeLink = document.createElement("a");
    youtubeLink.className = "youtube-highlights";
    youtubeLink.href =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(
            `${player.Name || "football player"} highlights`
        );
    youtubeLink.target = "_blank";
    youtubeLink.rel = "noopener noreferrer";

    const youtubeIcon = document.createElement("span");
    youtubeIcon.className = "youtube-icon";
    youtubeIcon.textContent = "▶";

    const youtubeText = document.createElement("span");
    youtubeText.textContent = "WATCH PLAYER HIGHLIGHTS ON YOUTUBE";

    youtubeLink.append(youtubeIcon, youtubeText);
    content.appendChild(youtubeLink);

    const title = document.createElement("h2");
    title.className = "profile-section-title";
    title.textContent = "PLAYER INFORMATION & ATTRIBUTES";
    content.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "profile-grid";

    Object.entries(player).forEach(([key, value]) => {
        if (
            key === "card" ||
            key === "url" ||
            value === "" ||
            value == null
        ) {
            return;
        }

        const item = document.createElement("div");
        item.className = "profile-item";

        const label = document.createElement("span");
        label.textContent = key.replaceAll("_", " ");

        const data = document.createElement("strong");
        data.textContent = String(value);

        item.append(label, data);
        grid.appendChild(item);
    });

    content.appendChild(grid);
}

function closeProfile() {
    if ($("profileModal")) {
        $("profileModal").classList.add("hidden");
    }

    document.body.style.overflow = "";
}

if ($("closeProfile")) {
    $("closeProfile").addEventListener("click", closeProfile);
}

if ($("profileModal")) {
    $("profileModal").addEventListener("click", event => {
        if (event.target === $("profileModal")) {
            closeProfile();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeProfile();

        if ($("suggestions")) {
            $("suggestions").classList.add("hidden");
        }
    }
});


// ---------------- INITIALIZATION ----------------

async function loadOptionsIfNeeded() {
    if (!optionsLoaded) {
        await loadOptions();
    }
}

loadOptions();